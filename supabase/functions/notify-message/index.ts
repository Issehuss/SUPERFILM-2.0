// supabase/functions/notify-message2/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const REPORT_TO_EMAILS = (Deno.env.get("REPORT_TO_EMAILS") || "")
  .split(",").map(s => s.trim()).filter(Boolean);

// If true, we'll still record a report even if the message isn't found yet
const ALLOW_MISSING_MESSAGE = true;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

function decodeJwtSub(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);
    return payload?.sub ?? null; // Supabase user id
  } catch {
    return null;
  }
}

async function sendEmail(to: string[], subject: string, html: string, text: string) {
  if (!RESEND_API_KEY || !to.length) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "SuperFilm Reports <reports@superfilm.app>", to, subject, html, text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const headers = { ...corsHeaders, "Content-Type": "application/json" };
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { messageId, clubId, reason = null } = await req.json();
    if (!messageId || !clubId) {
      return new Response(JSON.stringify({ error: "Missing messageId or clubId" }), { status: 400, headers });
    }

    // Fast local decode to get reporter id (no network call)
    const reporterId = decodeJwtSub(req.headers.get("Authorization"));
    if (!reporterId) {
      return new Response(JSON.stringify({ error: "Unauthenticated" }), { status: 401, headers });
    }

    // Try to find the message quickly; if not found, optionally still record report
    const { data: msg } = await supabase
      .from("club_messages")
      .select("id, club_id, user_id, body, created_at")
      .eq("id", messageId)
      .maybeSingle();

    // Prepare minimal snapshot
    const snapshot = msg
      ? {
          message: { id: msg.id, body: msg.body ?? null, created_at: msg.created_at },
          sender: { id: msg.user_id ?? null },
          club: { id: msg.club_id ?? clubId },
          reporter: { id: reporterId },
          reason,
        }
      : {
          message_missing: true,
          message_id: messageId,
          club_id: clubId,
          reporter: { id: reporterId },
          reason,
        };

    // Insert report (treat duplicates as soft success)
    const { data: inserted, error: insErr } = await supabase
      .from("message_reports")
      .insert({
        club_id: snapshot.club?.id ?? clubId,
        message_id: messageId,
        reporter_id: reporterId,
        reason,
        snapshot,
      })
      .select("id")
      .maybeSingle();

    if (insErr) {
      const code = (insErr as any)?.code;
      if (code === "23505") {
        // duplicate → OK for UX
        return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200, headers });
      }
      if (!msg && !ALLOW_MISSING_MESSAGE) {
        return new Response(JSON.stringify({ error: "Message not found" }), { status: 404, headers });
      }
      return new Response(JSON.stringify({ error: insErr.message }), { status: 400, headers });
    }

    // ✅ Respond immediately
    const response = new Response(JSON.stringify({ ok: true, reportId: inserted?.id }), {
      status: 200, headers,
    });

    // 🔧 Background work (non-blocking)
    (async () => {
      try {
        // Optional audit log
        await supabase.from("report_events").insert({
          report_id: inserted?.id,
          reporter_id: reporterId,
          channel: "edge_notify",
          payload: snapshot,
        });

        // Optional email
        if (REPORT_TO_EMAILS.length) {
          const clubName = snapshot.club?.name || snapshot.club?.id || clubId;
          const when = msg?.created_at ? new Date(msg.created_at).toLocaleString() : "";
          const subj = msg ? `⚠️ Reported message in ${clubName}` : `⚠️ Reported message (not found)`;
          const text = [
            `Club: ${clubName}`,
            `Message ID: ${messageId}`,
            `Reported by: ${reporterId}`,
            when ? `When: ${when}` : null,
            `Reason: ${reason || "(none provided)"}`,
            "",
            "Content:",
            String(msg?.body ?? "(not available)"),
          ].filter(Boolean).join("\n");
          const html = `
            <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
              <h2>${msg ? "Reported message" : "Reported message (not found)"}</h2>
              <p><b>Club:</b> ${clubName}</p>
              <p><b>Message ID:</b> ${messageId}</p>
              <p><b>Reported by:</b> ${reporterId}</p>
              ${when ? `<p><b>When:</b> ${when}</p>` : ""}
              <p><b>Reason:</b> ${reason ? String(reason).replace(/</g,"&lt;") : "(none provided)"}</p>
              ${msg ? `<hr /><p><b>Content:</b></p>
                <pre style="white-space:pre-wrap;background:#111;color:#fff;padding:12px;border-radius:8px;">${String(msg.body ?? "").replace(/</g,"&lt;")}</pre>` : ""}
            </div>
          `;
          await sendEmail(REPORT_TO_EMAILS, subj, html, text);
        }
      } catch {
        // swallow background errors
      }
    })();

    return response;
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers });
  }
});
