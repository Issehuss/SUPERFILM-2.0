import supabase from "../supabaseClient";

const ALLOWED_REASONS = new Set([
  "abuse",
  "harassment",
  "spam",
  "nsfw",
  "hate speech",        // NOTE: space (matches your enum)
  "self-harm content",  // NOTE: hyphen + space
  "other",
]);

export default function useReports() {
  const reportContent = async ({
    targetType,
    targetId = null,      // allow null from surveys/general
    clubId = null,
    reason = "other",     // default safe
    details = "",
  }) => {
    // always coerce to a valid enum
    const trimmedReason = (reason ?? "").toString().trim();
    const isValid = ALLOWED_REASONS.has(trimmedReason);
    const safeReason = isValid ? trimmedReason : "other";

    // if invalid, preserve what user typed into details so nothing is lost
    const mergedDetails =
      !isValid && trimmedReason
        ? (details ? `${details}\n\nUser-entered reason: ${trimmedReason}` : `User-entered reason: ${trimmedReason}`)
        : details;

    // get current user
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user?.id) throw new Error("You must be signed in to report.");

    // insert (do not block on email)
    const { data, error } = await supabase
      .from("content_reports")
      .insert([{
        reporter_id: user.id,
        target_type: targetType || "general",
        target_id: targetId,            // may be null if general
        club_id: clubId,
        reason: safeReason,             // ALWAYS enum-safe
        details: mergedDetails?.trim() || null,
        status: "open",
      }])
      .select()
      .single();

    if (error) throw error;

    // fire the email (best-effort)
    try {
      
    } catch (e) {
      console.warn("[notify-report] invoke failed:", e?.message || e);
    }

    return data;
  };

  return { reportContent };
}
