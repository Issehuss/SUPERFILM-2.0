// supabase/functions/create-portal/index.ts
// Deno Edge Function
import Stripe from "npm:stripe@^16.6.0";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  // Health & CORS
  if (req.method === "GET") return new Response("ok");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  try {
    const { user } = await getSupabaseUser(req);
    if (!user) return json(401, { error: "Not authenticated" }, req);

    const supabase = await createSB();

    // Try to get existing mapping
    const { data: existing, error: mapErr } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (mapErr) console.error("[create-portal] mapping lookup error:", mapErr);

    let stripeCustomerId = existing?.stripe_customer_id;

    // If no mapping (or stale), create/recover a Stripe customer and upsert mapping.
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      stripeCustomerId = customer.id;

      const { error: upErr } = await supabase
        .from("billing_customers")
        .upsert({ user_id: user.id, stripe_customer_id: stripeCustomerId }, { onConflict: "user_id" });
      if (upErr) console.error("[create-portal] mapping upsert error:", upErr);
    } else {
      // Ensure referenced customer still exists; recreate if deleted
      try {
        const cust = await stripe.customers.retrieve(stripeCustomerId);
        // @ts-ignore Stripe typing – 'deleted' only on DeletedCustomer
        if ((cust as any)?.deleted) {
          const newCust = await stripe.customers.create({
            email: user.email,
            metadata: { user_id: user.id },
          });
          stripeCustomerId = newCust.id;
          const { error: upErr } = await supabase
            .from("billing_customers")
            .upsert({ user_id: user.id, stripe_customer_id: stripeCustomerId }, { onConflict: "user_id" });
          if (upErr) console.error("[create-portal] mapping upsert error (recreate):", upErr);
        }
      } catch (e) {
        console.warn("[create-portal] retrieve customer failed, recreating:", e);
        const newCust = await stripe.customers.create({
          email: user.email,
          metadata: { user_id: user.id },
        });
        stripeCustomerId = newCust.id;
        const { error: upErr } = await supabase
          .from("billing_customers")
          .upsert({ user_id: user.id, stripe_customer_id: stripeCustomerId }, { onConflict: "user_id" });
        if (upErr) console.error("[create-portal] mapping upsert error (recreate fallback):", upErr);
      }
    }

    // Fetch latest subscription for targeted cancel flow
    let latestSubId: string | null = null;
    try {
      const subs = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "all",
        limit: 1,
        expand: ["data.default_payment_method"],
      });
      latestSubId = subs.data?.[0]?.id || null;
    } catch (e) {
      console.warn("[create-portal] subscriptions.list failed:", e);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin(req)}/settings/premium`,
      ...(latestSubId
        ? {
            flow_data: {
              type: "subscription_cancel",
              subscription_cancel: { subscription: latestSubId },
            },
          }
        : {}),
    });

    return json(200, { url: session.url }, req);
  } catch (e) {
    console.error("[create-portal] error:", e);
    return json(500, { error: String(e) }, req);
  }
});

/* ---------------- Helpers ---------------- */

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin === "null" ? "*" : origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

function origin(req: Request) {
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

async function getSupabaseUser(req: Request) {
  // Expect Authorization: Bearer <JWT from supabase.auth.getSession()>
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return { user: null };

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_SERVICE_ROLE_KEY },
  });
  if (!res.ok) return { user: null };
  const user = await res.json();
  return { user };
}

async function createSB() {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function json(status: number, body: unknown, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}
