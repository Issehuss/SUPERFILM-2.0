// src/lib/reports.js
import supabase from "lib/supabaseClient";

/** Allowed values must match your Postgres enums exactly */
export const REPORT_TARGETS = ["message", "post", "profile", "club"];
export const REPORT_REASONS = [
  "abuse",
  "harassment",
  "spam",
  "nsfw",
  "hate",
  "self-harm",
  "other",
];

/* ─────────────────────────────── constants ─────────────────────────────── */
// Hard-coded to match your Supabase dashboard
const REPORT_NOTIFY_FN = "notify-report";
const NOTIFY_MESSAGE_FN = "notify-message2";

// PG duplicate/unique helpers
function isUniqueViolation(err) {
  const m = (err?.message || "").toLowerCase();
  const c = (err?.code || "").toString();
  return (
    c === "23505" ||
    m.includes("duplicate key") ||
    m.includes("already exists") ||
    m.includes("unique constraint") ||
    m.includes("content_reports_no_dupe")
  );
}

/* ─────────────────────────────── API ─────────────────────────────── */
/**
 * Inserts a row in public.content_reports, then (optionally) invokes an Edge Function to notify mods.
 *
 * @param {Object} args
 * @param {'message'|'post'|'profile'|'club'} args.targetType
 * @param {string} args.targetId
 * @param {'abuse'|'harassment'|'spam'|'nsfw'|'hate'|'self-harm'|'other'} args.reason
 * @param {string=} args.details
 * @param {string=} args.clubId
 * @param {boolean=} args.notify (default: true)
 * @returns {Promise<{ok:boolean, data?:any, error?:string, duplicate?:boolean}>}
 */
export async function createContentReport({
  targetType,
  targetId,
  reason,
  details,
  clubId,
  notify = true,
}) {
  // guards
  if (!REPORT_TARGETS.includes(targetType)) {
    return { ok: false, error: `Invalid targetType "${targetType}".` };
  }
  if (!REPORT_REASONS.includes(reason)) {
    return { ok: false, error: `Invalid reason "${reason}".` };
  }
  if (!targetId) return { ok: false, error: "targetId is required." };

  // must be signed in
  const { data: ures } = await supabase.auth.getUser();
  const user = ures?.user;
  if (!user) return { ok: false, error: "You must be signed in to report." };

  const payload = {
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason,
    details: details || null,
    club_id: clubId || null,
  };

  // insert
  const { data, error } = await supabase
    .from("content_reports")
    .insert(payload)
    .select()
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, duplicate: true, error: "You’ve already reported this." };
    }
    return { ok: false, error: error.message || "Failed to submit report." };
  }

  // notify via Edge Function (fire-and-forget)
  if (notify) {
    try {
      await supabase.functions.invoke(REPORT_NOTIFY_FN, {
        body: {
          report: data,
          reporter: { id: user.id, email: user.email ?? null },
        },
      });
    } catch {
      // ignore notify failures; report already saved
    }
  }

  return { ok: true, data };
}

/**
 * updateReportStatus (for admins / club leaders per your RLS)
 * @param {string} reportId
 * @param {'open'|'dismissed'|'actioned'} status
 */
export async function updateReportStatus(reportId, status) {
  const { data, error } = await supabase
    .from("content_reports")
    .update({ status, handled_at: new Date().toISOString() })
    .eq("id", reportId)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

/** reporter sees only their reports (RLS should enforce) */
export async function listMyReports() {
  const { data, error } = await supabase
    .from("content_reports")
    .select("id, created_at, target_type, target_id, reason, details, club_id, status, handled_at")
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

/** moderators view (RLS enforces scope) */
export async function listReportsForModeration({ clubId } = {}) {
  let q = supabase
    .from("content_reports")
    .select("id, created_at, target_type, target_id, reason, details, club_id, status, handled_at")
    .order("created_at", { ascending: false });
  if (clubId) q = q.eq("club_id", clubId);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

/* ───────────────────────── chat message notifier (optional) ───────────────────────── */
/**
 * callNotifyMessageFn — use when reporting chat messages elsewhere
 * @param {{ messageId:string, clubId?:string, reason?:string, extra?:any }} args
 */
export async function callNotifyMessageFn({ messageId, clubId, reason, extra }) {
  const { error } = await supabase.functions.invoke(NOTIFY_MESSAGE_FN, {
    body: { messageId, clubId: clubId ?? null, reason: reason ?? null, extra: extra ?? null },
  });
  if (error) throw error;
  return { ok: true };
}
