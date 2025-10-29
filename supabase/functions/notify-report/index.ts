// supabase/functions/notify-report/index.ts
// Receives: { report, reporter } from the client after inserting into content_reports.
// Side effects: optional email via Resend, optional audit log insert.
// CORS-safe, POST-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const REPORT_TO_EMAILS = (Deno.env.get("REPORT_TO_EMAILS") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*", // or set to your exact origin
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

async function sendResendEmail(params: {
  to: string[];
  subject: string;
  html: string;
  text: string;
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SuperFilm Reports <reports@superfilm.app>",
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Expected body: { report, reporter }
    const body = await req.json().catch(() => ({}));
    const report = body?.report ?? null;
    const reporter = body?.reporter ?? null;

    if (!report?.id) {
      return new Response(JSON.stringify({ error: "Missing report payload with id" }), {
        status: 400,
        headers,
      });
    }

    // Optional: persist an audit trail (ignore errors if table doesn’t exist)
    try {
      await supabase.from("report_events").insert({
        report_id: report.id,
        reporter_id: reporter?.id ?? null,
        channel: "edge_notify",
        payload: report, // JSONB column recommended
      });
    } catch (_e) {
      // ignore (table may not exist)
    }

    // Email summary (only if configured)
    if (RESEND_API_KEY && REPORT_TO_EMAILS.length) {
      const targetType = String(report.target_type || "content");
      const reason = report.reason ? String(report.reason) : "(none provided)";
      const when = report.created_at ? new Date(report.created_at).toLocaleString() : "";

      const subject = `⚠️ New ${targetType} report`;
      const text = [
        `Report ID: ${report.id}`,
        `Target: ${targetType} → ${report.target_id}`,
        report.club_id ? `Club ID: ${report.club_id}` : null,
        `Reporter: ${reporter?.id ?? "(unknown)"}`,
        `When: ${when}`,
        `Reason: ${reason}`,
        report.details ? `Details: ${report.details}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const html = `
        <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;">
          <h2>New ${targetType} report</h2>
          <p><b>Report ID:</b> ${report.id}</p>
          <p><b>Target:</b> ${targetType} → ${report.target_id}</p>
          ${report.club_id ? `<p><b>Club ID:</b> ${report.club_id}</p>` : ""}
          <p><b>Reporter:</b> ${reporter?.id ?? "(unknown)"}</p>
          <p><b>When:</b> ${when}</p>
          <p><b>Reason:</b> ${reason.replace(/</g, "&lt;")}</p>
          ${
            report.details
              ? `<p><b>Details:</b></p><pre style="white-space: pre-wrap; background:#111; color:#fff; padding:12px; border-radius:8px;">${String(
                  report.details
                ).replace(/</g, "&lt;")}</pre>`
              : ""
          }
        </div>
      `;

      try {
        await sendResendEmail({
          to: REPORT_TO_EMAILS,
          subject,
          html,
          text,
        });
      } catch (emailErr) {
        // Return success but note email failure (report already saved in DB)
        return new Response(
          JSON.stringify({ ok: true, reportId: report.id, email: "failed", error: String(emailErr) }),
          { status: 200, headers }
        );
      }
    }

    return new Response(JSON.stringify({ ok: true, reportId: report.id }), {
      status: 200,
      headers,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers,
    });
  }
});
