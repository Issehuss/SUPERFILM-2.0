// supabase/functions/create-checkout/index.ts
// Deno Edge Function
import Stripe from "https://esm.sh/stripe@14.21.0";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const PRICE_ID = "price_1SIwfl24IM8j17vuMWLrYvo"; // Directors Cut Monthly (14-day trial, live)

// Supabase env vars are blocked with SUPABASE_* in the local edge runtime.
// Fall back to local-friendly keys so dev/test works without renaming secrets in prod.
const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || Deno.env.get("LOCAL_SUPABASE_URL") || "http://127.0.0.1:54321";
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  // Health & CORS
  if (req.method === "GET") return new Response("ok");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  try {
    // TEMP: allow unauthenticated calls for local Stripe testing
    const body = await readBody(req);
    const { user: authed } = await getSupabaseUser(req);
    const user =
      authed ||
      ({
        id: body?.userId ? String(body.userId) : "local-test-user",
        email: body?.email || "local-test@example.com",
      } as { id: string; email?: string });

    const supabase = await createSB();
    const customer = await getOrCreateCustomer(user, supabase);

    // Prefer a stable SITE_URL for success/cancel (avoids Docker internal hostnames)
    const siteUrl = Deno.env.get("SITE_URL");
    const urlBase = siteUrl || origin(req);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${urlBase}/premium/success`,
      cancel_url: `${urlBase}/premium`,
      subscription_data: {
        metadata: { userId: user.id },
      },
      // Nice-to-haves:
      allow_promotion_codes: true,
      // Optional: collect billing address if you need taxes/compliance
      billing_address_collection: "auto",
    });

    return json(200, { url: session.url }, req);
  } catch (e) {
    console.error("[create-checkout] error:", e);
    return json(500, { error: String(e) }, req);
  }
});

/* ---------------- Helpers ---------------- */

function corsHeaders(req: Request) {
  const originUrl = new URL(req.url);
  return {
    "Access-Control-Allow-Origin": originUrl.origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

function origin(req: Request) {
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

async function getSupabaseUser(req: Request) {
  // Expect the client to invoke with the user's session JWT in Authorization: Bearer <token>
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return { user: null };

  // Verify JWT with Supabase Auth API
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_SERVICE_ROLE_KEY },
  });
  if (!res.ok) return { user: null };
  const user = await res.json();
  return { user };
}

type SupabaseClient = Awaited<ReturnType<typeof createSB>>;

async function readBody(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

async function createSB() {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function getOrCreateCustomer(user: { id: string; email?: string }, supabase: SupabaseClient) {
  // Look up mapping
  const { data: existing, error: mapErr } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (mapErr) console.error("[create-checkout] mapping lookup error:", mapErr);

  if (existing?.stripe_customer_id) {
    // Retrieve to ensure it exists
    try {
      const cust = await stripe.customers.retrieve(existing.stripe_customer_id);
      // @ts-ignore Stripe types: ensure not deleted
      if (cust && !(cust as any).deleted) return cust as Stripe.Customer;
    } catch (e) {
      // fall through to recreate mapping/customer
      console.warn("[create-checkout] stale customer mapping, recreating:", e);
    }
  }

  // Create a new Stripe Customer, attach user_id for webhooks
  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { user_id: user.id },
  });

  // Upsert mapping (race-safe)
  const { error: upErr } = await supabase
    .from("billing_customers")
    .upsert({ user_id: user.id, stripe_customer_id: customer.id }, { onConflict: "user_id" });

  if (upErr) console.error("[create-checkout] mapping upsert error:", upErr);

  return customer;
}

function json(status: number, body: unknown, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(req) },
  });
}
