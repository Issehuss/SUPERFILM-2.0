import supabase from "../supabaseClient";
import { createNotification } from "./notify";

export async function requestToJoinClub(clubId) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) throw new Error("Sign in first.");
  
    const { error } = await supabase.rpc("upsert_membership_request", {
      p_club_id: clubId,
      p_user_id: userId,
    });
  
    if (error) throw error;

    // Notify club presidents about the new request
    try {
      // If the SECURITY DEFINER RPC exists, prefer it (bypasses RLS safely)
      const { error: rpcNotifyErr } = await supabase.rpc("notify_membership_request", {
        p_club_id: clubId,
        p_requester_id: userId,
      });
      if (!rpcNotifyErr) {
        return { ok: true };
      }

      // Fallback to client-side notification inserts (may be blocked by RLS)
      const { data: clubRow } = await supabase
        .from("clubs")
        .select("id, name, slug, created_by")
        .eq("id", clubId)
        .maybeSingle();

      const { data: staffRows } = await supabase
        .from("club_members")
        .select("club_id, user_id, role, joined_at, accepted")
        .eq("club_id", clubId)
        .eq("role", "president");

      const { data: memberRows } = await supabase
        .from("club_members")
        .select("club_id, user_id, role, joined_at, accepted")
        .eq("club_id", clubId)
        .eq("role", "president");

      const recipients = [
        ...(staffRows || []).map((r) => r.user_id),
        ...(memberRows || []).map((r) => r.user_id),
        clubRow?.created_by || null,
      ]
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i);

      await Promise.all(
        recipients.map((rid) =>
          createNotification({
            userId: rid,
            type: "club.membership.pending",
            clubId,
            data: {
              club_name: clubRow?.name || "Your club",
              slug: clubRow?.slug || clubId,
              href: `/clubs/${clubRow?.slug || clubId}/requests`,
              message: "New membership request awaiting approval",
            },
          })
        )
      );
    } catch (notifyErr) {
      console.warn("[membership request notify] failed", notifyErr?.message || notifyErr);
    }

    return { ok: true };
  }
