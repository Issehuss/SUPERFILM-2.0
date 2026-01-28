// src/lib/points.js
import supabase from "lib/supabaseClient";

/**
 * Call the server RPC to award points for an action.
 * - DB enforces weekly 6pt cap + dedup by (club,user,action,subject).
 * - We fire a "points-updated" event so UI (card/page) can refresh.
 */
export async function awardPointsForAction({ clubId, userId, action, subjectId, reason }) {
  if (!clubId || !userId || !action) return;

  const { error } = await supabase.rpc("award_points_for_action", {
    p_club: clubId,
    p_user: userId,
    p_action: action,
    p_subject: subjectId || null,
    p_reason: reason || null,
  });

  // Unique violation = already awarded for this subject → ignore silently
  if (error && !String(error.message).toLowerCase().includes("duplicate key")) {
    console.warn("[points] award_points_for_action error:", error.message);
  }

  // notify listeners (wide card, leaderboard page, etc.)
  window.dispatchEvent(new CustomEvent("points-updated", { detail: { clubId } }));
}
