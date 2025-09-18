// src/lib/reports.js
import supabase from "../supabaseClient";

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

/**
 * createContentReport
 * Inserts a row in public.content_reports.
 *
 * @param {Object} args
 * @param {'message'|'post'|'profile'|'club'} args.targetType
 * @param {string} args.targetId            // uuid of the thing being reported
 * @param {'abuse'|'harassment'|'spam'|'nsfw'|'hate'|'self-harm'|'other'} args.reason
 * @param {string=} args.details
 * @param {string=} args.clubId             // uuid if report pertains to a club context (optional)
 * @param {boolean=} args.notify            // call edge func / webhook after insert (default true)
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
  // quick guards to give helpful errors before hitting DB
  if (!REPORT_TARGETS.includes(targetType)) {
    return { ok: false, error: `Invalid targetType "${targetType}".` };
  }
  if (!REPORT_REASONS.includes(reason)) {
    return { ok: false, error: `Invalid reason "${reason}".` };
  }
  if (!targetId) {
    return { ok: false, error: "targetId is required." };
  }

  // must be signed in
  const { data: ures } = await supabase.auth.getUser();
  const user = ures?.user;
  if (!user) return { ok: false, error: "You must be signed in to report." };

  // insert
  const payload = {
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason,
    details: details || null,
    club_id: clubId || null,
  };

  const { data, error } = await supabase
    .from("content_reports")
    .insert(payload)
    .select()
    .single();

  if (error) {
    const msg = (error.message || "").toLowerCase();
    // handle unique constraint: content_reports_no_dupe
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return { ok: false, duplicate: true, error: "You’ve already reported this." };
    }
    return { ok: false, error: error.message || "Failed to submit report." };
  }

  // optional: notify (Edge Function, webhook, etc). Fire-and-forget.
  if (notify) {
    try {
      const fnBase =
        import.meta.env.VITE_SUPABASE_FUNCTIONS_URL ||
        process.env.REACT_APP_SUPABASE_FUNCTIONS_URL;
      if (fnBase) {
        await fetch(`${fnBase}/report-notify`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ report: data, reporter: user }),
        });
      }
    } catch {
      // ignore notification failures—report is already saved
    }
  }

  return { ok: true, data };
}

/**
 * updateReportStatus (for admins / club leaders per your RLS)
 * @param {string} reportId     // uuid
 * @param {'open'|'dismissed'|'actioned'} status
 * @returns {Promise<{ok:boolean, data?:any, error?:string}>}
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

/**
 * listMyReports: reporter sees only their reports (per your policy)
 */
export async function listMyReports() {
  const { data, error } = await supabase
    .from("content_reports")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

/**
 * listReportsForModeration: admins see all; club leaders see their club’s
 * (RLS enforces access; no service key needed if roles/funcs are correct.)
 */
export async function listReportsForModeration({ clubId } = {}) {
  let q = supabase.from("content_reports").select("*").order("created_at", { ascending: false });
  if (clubId) q = q.eq("club_id", clubId);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}
