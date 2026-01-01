import supabase from "../supabaseClient";

/** Assign role (server enforces leader-only via RPC) */
export async function assignClubRole({ clubId, userId, role }) {
  const { error } = await supabase.rpc("assign_club_role", {
    p_club_id: clubId,
    p_user_id: userId,
    p_role: role, // 'president' | 'vice_president' | 'member'
  });
  if (error) throw error;
}

/** User accepts/signs their assigned role */
export async function signMyClubRole({ clubId }) {
  const { error } = await supabase.rpc("sign_club_role", { p_club_id: clubId });
  if (error) throw error;
}

/** Fetch members with roles for a club (joins profile basics) */
export async function fetchClubMembersWithRoles(clubId) {
  const { data, error } = await supabase
    .from("club_members")
    .select(`
      user_id,
      role,
      role_signed_at,
      profiles:profiles!club_members_user_id_fkey (
        id, slug, display_name, avatar_url
      )
    `)
    .eq("club_id", clubId);
  if (error) throw error;
  return data || [];
}
