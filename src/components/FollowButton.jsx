import { useEffect, useState } from "react";
import supabase from "../supabaseClient.js";
import { useUser } from "../context/UserContext";

export default function FollowButton({ profileId }) {
  const { user } = useUser();
  const me = user?.id;
  const disabled = !me || me === profileId;
  const [loading, setLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  async function refresh() {
    if (!me || !profileId) return;
    const { data, error } = await supabase
      .from("profile_follows")
      .select("follower_id")
      .eq("follower_id", me)
      .eq("followee_id", profileId)
      .maybeSingle();
    if (!error) setIsFollowing(!!data);
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [me, profileId]);

  async function toggle() {
    if (disabled) return;
    setLoading(true);
    if (isFollowing) {
      await supabase.from("profile_follows")
        .delete()
        .eq("follower_id", me)
        .eq("followee_id", profileId);
    } else {
      await supabase.from("profile_follows")
        .insert({ follower_id: me, followee_id: profileId });
    }
    await refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={disabled || loading}
      className={`rounded-full px-3 py-1 text-sm border
        ${isFollowing ? 'border-zinc-600 bg-zinc-800 text-zinc-200' : 'border-yellow-400 text-yellow-300'}
        disabled:opacity-50`}
      aria-label={isFollowing ? "Unfollow" : "Follow"}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
