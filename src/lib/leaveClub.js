// src/lib/leaveClub.js
import supabase from "lib/supabaseClient";

export async function leaveClubAndMaybeDelete(clubId) {
  const { data, error } = await supabase.rpc("leave_club_and_maybe_delete", {
    club_uuid: clubId,
  });
  if (error) throw error;
  return data; // e.g. { deleted_club: true/false, remaining_members: number }
}
