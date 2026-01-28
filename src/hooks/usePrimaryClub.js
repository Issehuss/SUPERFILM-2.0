import { useEffect, useMemo, useState } from "react";
import supabase from "lib/supabaseClient";
import { useUser } from "../context/UserContext";
import useMyClubs from "./useMyClubs";
import useHydratedSupabaseFetch from "./useHydratedSupabaseFetch";

const CACHE_KEY = "cache:primaryClub:v1";
const TTL = 30 * 60 * 1000;

function readCache(userId) {
  if (!userId) return null;
  try {
    const raw = sessionStorage.getItem(`${CACHE_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || !parsed?.club) return null;
    if (Date.now() - parsed.at > TTL) return null;
    return parsed.club;
  } catch {
    return null;
  }
}

function writeCache(userId, club) {
  if (!userId || !club) return;
  try {
    sessionStorage.setItem(
      `${CACHE_KEY}:${userId}`,
      JSON.stringify({ at: Date.now(), club })
    );
  } catch {}
}

export default function usePrimaryClub({ refreshEpoch = 0 } = {}) {
  const { user, profile, sessionLoaded, membershipEpoch } = useUser();
  const { clubs: myClubs } = useMyClubs(undefined, { refreshEpoch });

  const cached = useMemo(() => readCache(user?.id), [user?.id]);
  const [club, setClub] = useState(cached);

  const { data: rpcClub, loading } = useHydratedSupabaseFetch(
    async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.rpc("get_my_primary_club");
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
    [refreshEpoch, membershipEpoch],
    {
      enabled: Boolean(sessionLoaded && user?.id),
      initialData: cached,
      userId: user?.id,
    }
  );

  useEffect(() => {
    if (!user?.id) {
      setClub(null);
      return;
    }

    if (rpcClub?.id) {
      setClub(rpcClub);
      writeCache(user.id, rpcClub);
      return;
    }

    if (profile?.primary_club_id && myClubs?.length) {
      const fallback = myClubs.find((c) => c.id === profile.primary_club_id);
      if (fallback) {
        setClub(fallback);
        writeCache(user.id, fallback);
        return;
      }
    }

    setClub(null);
  }, [user?.id, rpcClub?.id, profile?.primary_club_id, myClubs, membershipEpoch]);

  return {
    club,
    loading,
  };
}
