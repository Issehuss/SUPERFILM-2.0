import supabase from "../supabaseClient";

export async function requestToJoinClub(clubId) {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) throw new Error("Sign in first.");
  
    const { error } = await supabase.rpc("upsert_membership_request", {
      p_club_id: clubId,
      p_user_id: userId,
    });
  
    if (error) throw error;
    return { ok: true };
  }