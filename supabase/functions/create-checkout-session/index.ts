import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = (() => {
  const envUrl = (Deno.env.get("SITE_URL") || "").trim();
  const candidate = envUrl || "https://superfilm.uk";
  if (!candidate.startsWith("http")) {
    console.warn("[create-checkout-session] Invalid SITE_URL, falling back to https://superfilm.uk");
    return "https://superfilm.uk";
  }
  return candidate.replace(/\/+$/, "");
})();

const PRICE_ID = Deno.env.get("STRIPE_DIRECTORS_CUT_PRICE_ID") || "price_1Siwlf246lM8j17vmUWIyoWO"; // Directors Cut monthly

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return respond(req, 405, "Method Not Allowed");

  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      console.warn("[create-checkout-session] missing auth token");
      return respond(req, 401, "Unauthorized: missing token");
    }
    const { data, error: userErr } = await supabaseAdmin.auth.getUser(token);
    const user = data?.user;
    if (userErr || !user) {
      console.warn("[create-checkout-session] auth.getUser failed", userErr?.message || "no user");
      return respond(req, 401, "Unauthorized: invalid token");
    }

    // 1. Get or create Stripe customer mapping
    let stripeCustomerId: string | null = null;
    const { data: existing } = await supabaseAdmin
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing?.stripe_customer_id) stripeCustomerId = existing.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { user_id: user.id },
      });
      stripeCustomerId = customer.id;
      await supabaseAdmin
        .from("stripe_customers")
        .upsert({ user_id: user.id, stripe_customer_id: stripeCustomerId }, { onConflict: "user_id" });
    } else {
      // ensure existing customer still valid
      try {
        const cust = await stripe.customers.retrieve(stripeCustomerId);
        // @ts-ignore Stripe deleted typing
        if ((cust as any)?.deleted) {
          const customer = await stripe.customers.create({
            email: user.email || undefined,
            metadata: { user_id: user.id },
          });
          stripeCustomerId = customer.id;
          await supabaseAdmin
            .from("stripe_customers")
            .upsert({ user_id: user.id, stripe_customer_id: stripeCustomerId }, { onConflict: "user_id" });
        }
      } catch {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { user_id: user.id },
        });
        stripeCustomerId = customer.id;
        await supabaseAdmin
          .from("stripe_customers")
          .upsert({ user_id: user.id, stripe_customer_id: stripeCustomerId }, { onConflict: "user_id" });
      }
    }

    // 2. Create Checkout Session
    console.log("[create-checkout-session] creating session for user:", user.id);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      client_reference_id: user.id, // ensure webhook can resolve user
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${SITE_URL}/directors-cut/success`,
      cancel_url: `${SITE_URL}/directors-cut/cancel`,
      metadata: { user_id: user.id },
      subscription_data: {
        trial_period_days: 14,
        metadata: { user_id: user.id },
      },
    });

    console.log(
      "[create-checkout-session] session created:",
      session.id,
      session.client_reference_id,
      session.metadata
    );

    return respond(
      req,
      200,
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { "Content-Type": "application/json" }
    );
  } catch (err) {
    console.error("[create-checkout-session] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return respond(req, 500, `Error creating checkout session: ${message}`);
  }
});

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin === "null" ? "*" : origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function respond(req: Request, status: number, body: string, extraHeaders: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: { ...corsHeaders(req), ...extraHeaders },
  });
}
