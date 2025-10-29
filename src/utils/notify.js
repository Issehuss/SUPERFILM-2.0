import supabase from "../supabaseClient";

/**
 * Creates a notification row for a recipient.
 * `data` should include { club_name, slug, chat_path, snippet }
 */
export async function createNotification({
  userId,
  type,
  actorId,
  clubId,
  data = {},
}) {
  if (!userId || !type) return;
  return await supabase.from("notifications").insert({
    user_id: userId,
    type,
    actor_id: actorId || null,
    club_id: clubId || null,
    data,
  });
}
