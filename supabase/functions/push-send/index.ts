import webpush from "https://esm.sh/web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@superfilm.uk";
const ALLOW_USER_TEST = Deno.env.get("PUSH_ALLOW_USER_TEST") === "true";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

function decodeJwt(authHeader: string | null): { sub: string | null; role: string | null } {
  if (!authHeader) return { sub: null, role: null };
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length < 2) return { sub: null, role: null };
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);
    return { sub: payload?.sub ?? null, role: payload?.role ?? null };
  } catch {
    return { sub: null, role: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  const { sub, role } = decodeJwt(req.headers.get("Authorization"));
  const payload = await req.json().catch(() => ({}));
  const userId = payload?.user_id || null;
  const userIds = Array.isArray(payload?.user_ids) ? payload.user_ids : null;
  const isServiceRole = role === "service_role";
  const isAllowedUserTest = ALLOW_USER_TEST && payload?.test === true && sub && sub === userId;

  if (!isServiceRole && !isAllowedUserTest) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ error: "Missing VAPID keys" }), { status: 500, headers });
  }

  const targets = userIds?.length ? userIds : userId ? [userId] : [];
  if (!targets.length) {
    return new Response(JSON.stringify({ error: "Missing user_id(s)" }), { status: 400, headers });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  try {
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", targets);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers });
    }

    const title = payload?.title || "SuperFilm";
    const body = payload?.body || "";
    const url = payload?.url || "/";
    const data = payload?.data || {};
    const message = JSON.stringify({ title, body, url, data });

    const results = await Promise.all(
      (subs || []).map(async (s) => {
        const subscription = {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        };
        try {
          await webpush.sendNotification(subscription, message);
          return { id: s.id, ok: true };
        } catch (err) {
          const status = err?.statusCode || err?.status || 0;
          if (status === 404 || status === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", s.id);
          }
          return { id: s.id, ok: false, status };
        }
      })
    );

    const sent = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;
    return new Response(JSON.stringify({ ok: true, sent, failed }), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers });
  }
});
