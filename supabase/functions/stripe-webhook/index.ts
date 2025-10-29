// supabase/functions/stripe-webhook/index.ts
import Stripe from "npm:stripe@^16.6.0";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

/**
 * Required env vars (set in Supabase):
 *  - STRIPE_SECRET_KEY
 *  - STRIPE_WEBHOOK_SECRET
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY
 */
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type SupabaseClient = Awaited<ReturnType<typeof createSB>>;

serve(async (req) => {
  // Health & CORS
  if (req.method === "GET") return new Response("ok");
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing Stripe signature", { status: 400 });

  let rawBody: string;
  try {
    rawBody = await req.text(); // raw body required for verification
  } catch (e) {
    console.error("[stripe-webhook] failed to read body:", e);
    return new Response("Bad Request", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed:", err);
    return new Response("Bad signature", { status: 400 });
  }

  const sb = await createSB();

  // -------- Mode guard (prevents cross-mode noise) --------
  try {
    const isTestKey = Deno.env.get("STRIPE_SECRET_KEY")?.startsWith("sk_test_");
    const shouldBeLive = !isTestKey;
    if (typeof event.livemode === "boolean" && event.livemode !== shouldBeLive) {
      console.warn("[stripe-webhook] ignoring event from wrong mode", {
        id: event.id,
        type: event.type,
        livemode: event.livemode,
      });
      return new Response("ok", { status: 200, headers: corsHeaders(req) });
    }
  } catch (e) {
    // Non-fatal; continue
    console.warn("[stripe-webhook] mode guard check failed:", e);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = session.subscription as string | undefined;
        if (!subscriptionId) break;

        const customerId = await resolveCustomerId(session.customer);
        const userId =
          (await getUserFromCustomer(customerId, sb)) ||
          (await guessUserFromSession(session, sb)); // fallback via email if stored

        await audit(sb, event, userId ?? null);

        if (!userId) {
          console.warn("[webhook] no user_id for checkout.session.completed");
          break;
        }

        await ensureCustomerMapping(userId, customerId, sb);

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        await upsertSubscription(sub, userId, sb);
        await setPlanFromSubscription(sub, userId, sb);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        const customerId = await resolveCustomerId(sub.customer);
        const userId =
          sub.metadata?.user_id ||
          (await getUserFromCustomer(customerId, sb)) ||
          (await guessUserFromSubscription(sub, sb));

        await audit(sb, event, userId ?? null);

        if (!userId) {
          console.warn(
            `[webhook] no user_id for ${event.type} (customer=${customerId})`
          );
          break;
        }

        await ensureCustomerMapping(userId, customerId, sb);
        await upsertSubscription(sub, userId, sb);
        await setPlanFromSubscription(sub, userId, sb);
        break;
      }

      // Keep UI in sync on failures (plan stays premium during past_due grace)
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        if (!inv.subscription || !inv.customer) break;

        const sub = await stripe.subscriptions.retrieve(
          inv.subscription as string
        );
        const customerId = await resolveCustomerId(inv.customer);
        const userId =
          sub.metadata?.user_id ||
          (await getUserFromCustomer(customerId, sb)) ||
          (await guessUserFromSubscription(sub, sb));

        await audit(sb, event, userId ?? null);
        if (!userId) break;

        await upsertSubscription(sub, userId, sb);
        await setPlanFromSubscription(sub, userId, sb);
        break;
      }

      default:
        // Unhandled event types are fine; we still ack.
        // console.log(`[webhook] Unhandled event: ${event.type}`);
        break;
    }
  } catch (e) {
    // Do NOT throw — always ack so Stripe doesn't retry endlessly on duplicates
    console.error("[stripe-webhook] handler error:", e);
  }

  return new Response("ok", { status: 200, headers: corsHeaders(req) });
});

/* ---------------- Helpers ---------------- */

function corsHeaders(req: Request) {
  const origin = new URL(req.url).origin;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, stripe-signature",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

async function createSB() {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

async function resolveCustomerId(
  customer: string | Stripe.Customer | null
): Promise<string> {
  if (!customer) return "";
  return typeof customer === "string" ? customer : customer.id;
}

async function getUserFromCustomer(
  stripeCustomerId: string,
  sb: SupabaseClient
): Promise<string | null> {
  if (!stripeCustomerId) return null;
  const { data, error } = await sb
    .from("billing_customers")
    .select("user_id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();
  if (error) {
    console.error("[getUserFromCustomer] error:", error);
    return null;
  }
  return data?.user_id ?? null;
}

async function ensureCustomerMapping(
  userId: string,
  stripeCustomerId: string,
  sb: SupabaseClient
): Promise<void> {
  if (!userId || !stripeCustomerId) return;
  const { data } = await sb
    .from("billing_customers")
    .select("user_id, stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.stripe_customer_id === stripeCustomerId) return;

  const { error: upErr } = await sb
    .from("billing_customers")
    .upsert(
      { user_id: userId, stripe_customer_id: stripeCustomerId },
      { onConflict: "user_id" }
    );
  if (upErr) console.error("[ensureCustomerMapping] upsert error:", upErr);
}

async function upsertSubscription(
  sub: Stripe.Subscription,
  userId: string,
  sb: SupabaseClient
): Promise<void> {
  const priceId = sub.items?.data?.[0]?.price?.id ?? "unknown";
  const payload = {
    user_id: userId,
    stripe_subscription_id: sub.id,
    status: sub.status,
    price_id: priceId,
    current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    cancel_at_period_end: !!sub.cancel_at_period_end,
  };

  const { error } = await sb
    .from("subscriptions")
    .upsert(payload, { onConflict: "stripe_subscription_id" });
  if (error) console.error("[upsertSubscription] error:", error);
}

async function setPlanFromSubscription(
  sub: Stripe.Subscription,
  userId: string,
  sb: SupabaseClient
): Promise<void> {
  // Treat "past_due" as premium (grace)
  const activeStatuses: Stripe.Subscription.Status[] = [
    "active",
    "trialing",
    "past_due",
  ];
  const isActive = activeStatuses.includes(sub.status);

  const startedIso = new Date(sub.current_period_start * 1000).toISOString();
  const expiresIso = new Date(sub.current_period_end * 1000).toISOString();

  const { error } = await sb.rpc("set_premium_state", {
    p_user_id: userId,
    p_plan: isActive ? "directors_cut" : "free",
    p_started_at: startedIso,
    p_expires_at: expiresIso,
    p_cancel_at_period_end: !!sub.cancel_at_period_end,
  });

  if (error) console.error("[setPlanFromSubscription] rpc error:", error);
}

/**
 * Fallback when no billing_customers mapping exists:
 * Try to infer the user from the Checkout Session email.
 * (Only works if you store email on profiles.)
 */
async function guessUserFromSession(
  session: Stripe.Checkout.Session,
  sb: SupabaseClient
): Promise<string | null> {
  const email =
    (session.customer_details?.email as string | undefined) ||
    (session.customer_email as string | undefined) ||
    null;
  if (!email) return null;

  const { data, error } = await sb
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (error) return null;
  return data?.id ?? null;
}

/**
 * Fallback for subscription cases without mapping:
 * Use customer's email from the subscription object if present.
 */
async function guessUserFromSubscription(
  sub: Stripe.Subscription,
  sb: SupabaseClient
): Promise<string | null> {
  try {
    const customerId = await resolveCustomerId(sub.customer);
    const cust =
      typeof sub.customer === "string"
        ? ((await stripe.customers.retrieve(customerId)) as Stripe.Customer)
        : (sub.customer as Stripe.Customer);

    const email = cust.email;
    if (!email) return null;

    const { data, error } = await sb
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (error) return null;
    return data?.id ?? null;
  } catch {
    return null;
  }
}

/* ---------- Minimal audit (optional, safe if table missing) ---------- */
async function audit(
  sb: SupabaseClient,
  event: Stripe.Event,
  userId: string | null
) {
  try {
    await sb.from("webhook_events").insert({
      event_id: event.id,
      type: event.type,
      user_id: userId,
      created_at: new Date().toISOString(),
      livemode: event.livemode,
    });
  } catch {
    // ignore — table may not exist
  }
}
