import Stripe from "npm:stripe@^16.6.0";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async () => {
  const sb = await createSB();
  const { data: customers, error } = await sb
    .from("billing_customers")
    .select("user_id, stripe_customer_id");
  if (error || !customers) return new Response("ok");

  for (const c of customers) {
    try {
      const subs = await stripe.subscriptions.list({ customer: c.stripe_customer_id, limit: 1, status: "all" });
      const sub = subs.data[0];
      if (!sub) {
        await sb.rpc("set_premium_state", {
          p_user_id: c.user_id, p_plan: "free", p_started_at: null, p_expires_at: null, p_cancel_at_period_end: false
        });
        continue;
      }
      const active = ["active", "trialing", "past_due"].includes(sub.status);
      await sb.rpc("set_premium_state", {
        p_user_id: c.user_id,
        p_plan: active ? "directors_cut" : "free",
        p_started_at: new Date(sub.current_period_start*1000).toISOString(),
        p_expires_at: new Date(sub.current_period_end*1000).toISOString(),
        p_cancel_at_period_end: !!sub.cancel_at_period_end
      });
    } catch (e) {
      console.error("[reconcile] error:", e);
    }
  }
  return new Response("ok");
});

async function createSB() {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
