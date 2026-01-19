import { useEffect, useRef, useState } from 'react';
import supabase from '../supabaseClient';
import { useUser } from '../context/UserContext';
import useSafeSupabaseFetch from "./useSafeSupabaseFetch";
import useAppResume from "./useAppResume";

const CACHE_KEY = 'cache:myClubs:v1';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function readCache(userId) {
  if (!userId) return null;
  try {
    const raw = sessionStorage.getItem(`${CACHE_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || !parsed?.clubs) return null;
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.clubs;
  } catch {
    return null;
  }
}

function writeCache(userId, clubs) {
  if (!userId) return;
  try {
    sessionStorage.setItem(
      `${CACHE_KEY}:${userId}`,
      JSON.stringify({ at: Date.now(), clubs })
    );
  } catch {
    /* ignore cache write failures */
  }
}

export default function useMyClubs(userIdOverride) {
  const { user } = useUser();
  const userId = userIdOverride || user?.id || null;
  const cached = readCache(userId);

  const [clubs, setClubs] = useState(cached || []);
  const [loading, setLoading] = useState(() => !!userId && !cached);
  const [error, setError] = useState(null);
  const cachedRef = useRef(cached);
  const appResumeTick = useAppResume();

  const { data: fetchResult, loading: fetchLoading, error: fetchError, timedOut, retry } =
    useSafeSupabaseFetch(
      async (session) => {
        const resolvedUserId = userIdOverride || session?.user?.id;
        if (!resolvedUserId) throw new Error("no-user");

        const { data, error } = await supabase
          .from('club_members')
          .select('club_id, user_id, role, joined_at, accepted')
          .eq('user_id', resolvedUserId);
        if (error) throw error;

        const clubIds = (data || []).map((row) => row.club_id).filter(Boolean);
        let clubsMap = {};
        if (clubIds.length) {
          const { data: clubsData } = await supabase
            .from('clubs_public')
            .select('id, slug, name, profile_image_url')
            .in('id', clubIds);
          clubsMap = (clubsData || []).reduce((acc, c) => {
            acc[c.id] = c;
            return acc;
          }, {});
        }

        const flattened = (data || [])
          .map((row) => {
            const club = clubsMap[row.club_id] || {};
            return {
              role: row.role,
              id: row.club_id,
              slug: club.slug || null,
              name: club.name || "Club",
              profile_image_url: club.profile_image_url || null,
              next_screening: null,
            };
          })
          .filter((c) => c.id);

        let combined = flattened;
        if (!combined.length) {
          const { data: owned, error: ownedErr } = await supabase
            .from('clubs')
            .select('id, slug, name, profile_image_url')
            .eq('owner_id', resolvedUserId);
          if (ownedErr) {
            console.warn("[useMyClubs] owned fetch error:", ownedErr.message);
          }
          if (!ownedErr && owned?.length) {
            combined = owned.map((c) => ({ role: "owner", ...c, next_screening: null }));
          }
        }

        return { userId: resolvedUserId, clubs: combined };
      },
      [userIdOverride, appResumeTick],
      { enabled: true, timeoutMs: 8000 }
    );

  useEffect(() => {
    const cachedClubs = readCache(userId);
    if (cachedClubs?.length) {
      setClubs(cachedClubs);
      cachedRef.current = cachedClubs;
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(fetchLoading || (!!userId && !cachedRef.current));
  }, [fetchLoading, userId]);

  useEffect(() => {
    if (!fetchResult) return;
    setClubs(fetchResult.clubs || []);
    writeCache(fetchResult.userId, fetchResult.clubs || []);
    setError(null);
  }, [fetchResult]);

  useEffect(() => {
    if (fetchError && fetchError.message !== "no-user") {
      setError(fetchError);
      setLoading(false);
    }
  }, [fetchError]);

  useEffect(() => {
    if (timedOut) {
      setError(new Error("My clubs loading timed out"));
    }
  }, [timedOut]);

  // Re-run when Supabase refreshes the JWT to avoid "needs refresh" blanks
  useEffect(() => {
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setClubs([]);
        setLoading(false);
        return;
      }
      const sessionUserId = session?.user?.id;
      const resolvedUserId = userIdOverride || userId;
      if (!sessionUserId || (resolvedUserId && sessionUserId !== resolvedUserId)) return;
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        retry();
      }
    });

    return () => auth?.subscription?.unsubscribe();
  }, [retry, userId, userIdOverride]);

  return { clubs, loading, error };
}
