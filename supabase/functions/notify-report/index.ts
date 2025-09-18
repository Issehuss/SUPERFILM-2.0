import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// CORS for browser -> edge function calls
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 🔑 Read secrets (DO NOT hardcode values here)
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FOUNDER_EMAILS = (Deno.env.get("FOUNDER_EMAILS") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
// While testing with Resend dev mode, leave this fallback:
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "onboarding@resend.dev";

async function sendEmail(subject: string, text: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: FOUNDER_EMAILS, // array or comma string both OK
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error: ${body}`);
  }
}

serve(async (req) => {
  // Preflight request for CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const payload = await req.json().catch(() => ({}));
    // Accept either { record: {...} } or raw payload
    const r = payload?.record ?? payload ?? {};

    const subject = `🚨 New report: ${r?.reason ?? "unknown reason"}`;
    const text = [
      `Reporter: ${r?.reporter_id ?? "N/A"}`,
      `Target: ${r?.target_type ?? "?"} (${r?.target_id ?? "?"})`,
      `Club: ${r?.club_id ?? "N/A"}`,
      `Reason: ${r?.reason ?? "N/A"}`,
      "",
      "Details:",
      r?.details ?? "(none)",
      "",
      `Submitted at: ${r?.created_at ?? new Date().toISOString()}`,
    ].join("\n");

    await sendEmail(subject, text);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[notify-report] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
