// Fetch a user's club memberships and expose the first (primary) club.
import { useEffect, useState } from "react";
import supabase from "../supabaseClient";
import useSafeSupabaseFetch from "./useSafeSupabaseFetch";
import useAppResume from "./useAppResume";

const CACHE_KEY = "cache:myClub:v1";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function readCache(userId) {
  if (!userId) return null;
  try {
    const raw = sessionStorage.getItem(`${CACHE_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || !parsed?.club) return null;
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.club;
  } catch {
    return null;
  }
}

function writeCache(userId, club) {
  if (!userId) return;
  try {
    sessionStorage.setItem(
      `${CACHE_KEY}:${userId}`,
      JSON.stringify({ at: Date.now(), club })
    );
  } catch {
    /* ignore cache write failures */
  }
}

export default function useMyClub(userId) {
  const cached = readCache(userId);
  const [clubs, setClubs] = useState(cached ? [cached] : []);
  const [club, setClub] = useState(cached || null);
  const [loading, setLoading] = useState(!!userId && !cached);
  const [error, setError] = useState(null);
  const appResumeTick = useAppResume();

  useEffect(() => {
    const cachedClub = readCache(userId);
    if (cachedClub) {
      setClub(cachedClub);
      setClubs([cachedClub]);
      setLoading(false);
    }
  }, [userId]);

  const { data: fetchResult, loading: fetchLoading, error: fetchError, timedOut } =
    useSafeSupabaseFetch(
      async (session) => {
        const resolvedUserId = userId || session?.user?.id;
        if (!resolvedUserId) throw new Error("no-user");

        const { data, error: qErr } = await supabase
          .from("club_members")
          .select("club_id, user_id, role, joined_at, accepted")
          .eq("user_id", resolvedUserId);
        if (qErr) throw qErr;

        const clubIds = (data || []).map((row) => row.club_id).filter(Boolean);
        let clubsMap = {};
        if (clubIds.length) {
          const { data: clubsData } = await supabase
            .from("clubs_public")
            .select("id, slug, name, profile_image_url")
            .in("id", clubIds);
          clubsMap = (clubsData || []).reduce((acc, c) => {
            acc[c.id] = c;
            return acc;
          }, {});
        }

        const list = (data || [])
          .map((row) => {
            const clubData = clubsMap[row.club_id] || {};
            return {
              id: row.club_id,
              slug: clubData.slug || null,
              name: clubData.name || "Club",
              profile_image_url: clubData.profile_image_url || null,
              role: row.role,
              next_screening: null,
            };
          })
          .filter((c) => c.id);

        return { userId: resolvedUserId, clubs: list };
      },
      [userId, appResumeTick],
      { enabled: true, timeoutMs: 8000 }
    );

  useEffect(() => {
    setLoading(fetchLoading || (!!userId && !club));
  }, [fetchLoading, userId, club]);

  useEffect(() => {
    if (!fetchResult) return;
    setClubs(fetchResult.clubs || []);
    setClub(fetchResult.clubs?.[0] || null);
    writeCache(fetchResult.userId, fetchResult.clubs?.[0] || null);
    setError(null);
  }, [fetchResult]);

  useEffect(() => {
    if (fetchError && fetchError.message !== "no-user") {
      setError(fetchError);
    }
  }, [fetchError]);

  useEffect(() => {
    if (timedOut) {
      setError(new Error("My club loading timed out"));
    }
  }, [timedOut]);

  return { club, clubs, loading, error };
}
