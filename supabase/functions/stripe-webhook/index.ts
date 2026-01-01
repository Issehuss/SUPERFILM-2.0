import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-12-15",
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

Deno.serve(async (req) => {
  const rawBody = await req.text(); // raw body for Stripe signature verification

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    console.error("[stripe-webhook] missing Stripe signature header");
    return new Response("Missing Stripe signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log("[stripe-webhook] signature verified:", event.type);
  console.log("[stripe-webhook] verified event:", event.type);
  console.log("[stripe-webhook] event received:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = extractUserIdFromSession(session);
        console.log("[stripe-webhook] session identifiers:", session.client_reference_id, session.metadata);
        if (!userId) {
          console.error("Stripe webhook: missing user_id on checkout.session.completed");
          return new Response("Missing user_id", { status: 400 });
        }

        console.log("[stripe-webhook] updating profile for user:", userId);
        await forceTouchProfile(userId);

        const expiresSeconds = session.expires_at || null;

        await updateProfilePremium(userId, expiresSeconds, false);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        const mappedUserId = await extractUserIdFromSubscription(subscription);

        if (!mappedUserId) {
          console.error("Stripe webhook: missing user_id on subscription event");
          return new Response("Missing user_id", { status: 400 });
        }

        console.log("[stripe-webhook] updating profile for user:", mappedUserId);
        await forceTouchProfile(mappedUserId);

        const periodStart =
          subscription.current_period_start ??
          subscription.start_date ??
          subscription.billing_cycle_anchor ??
          subscription.items.data[0]?.current_period_start ??
          Math.floor(Date.now() / 1000);
        const periodEnd =
          subscription.current_period_end ??
          subscription.cancel_at ??
          subscription.items.data[0]?.current_period_end ??
          periodStart;

        const cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;

        const { error: upsertError } = await supabaseAdmin
          .from("subscriptions")
          .upsert(
            {
              user_id: mappedUserId,
              stripe_customer_id: subscription.customer as string,
              stripe_subscription_id: subscription.id,
              price_id: subscription.items.data[0]?.price?.id,
              status: subscription.status,
              current_period_start: new Date(periodStart * 1000),
              current_period_end: new Date(periodEnd * 1000),
              cancel_at_period_end: cancelAtPeriodEnd,
              canceled_at: subscription.canceled_at
                ? new Date(subscription.canceled_at * 1000)
                : null,
              updated_at: new Date(),
            },
            { onConflict: "stripe_subscription_id" }
          );

        if (upsertError) throw new Error(`Subscription upsert failed: ${upsertError.message}`);

        await updateProfilePremium(mappedUserId, periodEnd, cancelAtPeriodEnd);

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const mappedUserId = await extractUserIdFromSubscription(subscription);

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date(),
            updated_at: new Date(),
          })
          .eq("stripe_subscription_id", subscription.id);

        if (error) throw new Error(`Subscription cancel update failed: ${error.message}`);

        if (mappedUserId) {
          console.log("[stripe-webhook] updating profile for user:", mappedUserId);
          await forceTouchProfile(mappedUserId);
          await updateProfileCancel(mappedUserId);
        }

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const userId =
          (invoice.client_reference_id && invoice.client_reference_id.trim()) ||
          (invoice.metadata?.user_id && String(invoice.metadata.user_id)) ||
          (await resolveUserId(null, null, invoice.customer));
        if (!userId) {
          console.error("Stripe webhook: missing user_id on invoice.payment_failed");
          return new Response("Missing user_id", { status: 400 });
        }
        console.log("[stripe-webhook] updating profile for user:", userId);
        await forceTouchProfile(userId);
        await updateProfileCancel(userId);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const userId =
          (invoice.client_reference_id && invoice.client_reference_id.trim()) ||
          (invoice.metadata?.user_id && String(invoice.metadata.user_id)) ||
          (await resolveUserId(null, null, invoice.customer));

        if (!userId) {
          console.error("Stripe webhook: missing user_id on invoice.paid");
          return new Response("Missing user_id", { status: 400 });
        }

        console.log("[stripe-webhook] updating profile for user:", userId);
        await forceTouchProfile(userId);

        const periodEndSeconds =
          invoice.lines?.data?.[0]?.period?.end ??
          invoice.period_end ??
          invoice.lines?.data?.[0]?.period?.end ??
          null;
        await updateProfilePremium(userId, periodEndSeconds, false);
        break;
      }

      default:
        // No-op for other events for now; acknowledged for Stripe delivery
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new Response("Webhook error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
});

async function resolveUserId(
  clientRef?: string | null,
  metadata?: Stripe.Metadata | null,
  customer?: string | Stripe.Customer | null
) {
  if (clientRef && typeof clientRef === "string" && clientRef.trim().length) return clientRef;
  const metaUser = metadata?.user_id || metadata?.userId;
  if (metaUser && typeof metaUser === "string" && metaUser.trim().length) return metaUser;

  const customerId =
    typeof customer === "string"
      ? customer
      : (customer as Stripe.Customer | null)?.id;

  if (!customerId) return null;

  const { user_id } = await findUserIdByCustomer(customerId);
  return user_id || null;
}

function extractUserIdFromSession(session: Stripe.Checkout.Session) {
  return (
    (session.client_reference_id && session.client_reference_id.trim()) ||
    (session.metadata?.user_id && String(session.metadata.user_id))
  );
}

async function extractUserIdFromSubscription(subscription: Stripe.Subscription) {
  return (
    (subscription.metadata?.user_id && String(subscription.metadata.user_id)) ||
    (await resolveUserId(null, null, subscription.customer))
  );
}

async function findUserIdByCustomer(customerId: string) {
  const fromStripeCustomers = await supabaseAdmin
    .from("stripe_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (fromStripeCustomers.data?.user_id) {
    return { user_id: fromStripeCustomers.data.user_id, lookupError: fromStripeCustomers.error };
  }

  const fromBillingCustomers = await supabaseAdmin
    .from("billing_customers")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (fromBillingCustomers.data?.user_id) {
    return { user_id: fromBillingCustomers.data.user_id, lookupError: fromBillingCustomers.error };
  }

  if (fromStripeCustomers.error) {
    console.error("stripe_customers lookup failed in findUserIdByCustomer:", fromStripeCustomers.error.message);
    return { user_id: null, lookupError: fromStripeCustomers.error };
  }
  if (fromBillingCustomers.error) {
    console.error("billing_customers lookup failed in findUserIdByCustomer:", fromBillingCustomers.error.message);
    return { user_id: null, lookupError: fromBillingCustomers.error };
  }

  return { user_id: null, lookupError: null };
}

async function updateProfilePremium(
  userId: string,
  periodEndSeconds?: number | null,
  cancelAtPeriodEnd?: boolean
) {
  const nowIso = new Date().toISOString();
  const premiumExpiresAt =
    periodEndSeconds != null
      ? new Date(periodEndSeconds * 1000).toISOString()
      : null;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      is_premium: true,
      plan: "directors_cut",
      premium_started_at: nowIso,
      premium_since: nowIso,
      premium_expires_at: premiumExpiresAt,
      cancel_at_period_end: !!cancelAtPeriodEnd,
      updated_at: nowIso,
    })
    .eq("id", userId);

  if (error) {
    console.error("profiles premium update failed:", error.message);
    throw error;
  }
  console.log("[stripe-webhook] update result (premium):", data);
}

async function updateProfileCancel(userId: string) {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      is_premium: false,
      plan: "free",
      premium_expires_at: null,
      cancel_at_period_end: false,
      updated_at: nowIso,
    })
    .eq("id", userId);

  if (error) {
    console.error("profiles cancel update failed:", error.message);
    throw error;
  }
  console.log("[stripe-webhook] update result (cancel):", data);
}

async function forceTouchProfile(userId: string) {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ updated_at: nowIso })
    .eq("id", userId);
  if (error) {
    console.error("[stripe-webhook] forceTouchProfile failed:", error.message);
  } else {
    console.log("[stripe-webhook] forceTouchProfile result:", data);
  }
}
