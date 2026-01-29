import { useEffect, useRef, useState } from 'react';
import supabase from "lib/supabaseClient";
import { useUser } from '../context/UserContext';
import useHydratedSupabaseFetch from "./useHydratedSupabaseFetch";

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

export default function useMyClubs(userIdOverride, { refreshEpoch = 0 } = {}) {
  const { user, sessionLoaded, isReady, membershipEpoch } = useUser();
  const userId = userIdOverride || user?.id || null;
  const cached = readCache(userId);

  const [clubs, setClubs] = useState(cached || []);
  const [loading, setLoading] = useState(() => !!userId && !cached);
  const [error, setError] = useState(null);
  const cachedRef = useRef(cached);
  const userIdRef = useRef(userId);

  const fetcher = useRef(async () => {
    const resolvedUserId = userIdRef.current;
    if (!resolvedUserId) throw new Error("no-user");

    const { data, error } = await supabase
      .from('club_members')
      .select('club_id, user_id, role, joined_at, accepted')
      .eq('user_id', resolvedUserId)
      .eq('accepted', true);
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
  }).current;

  const ready = Boolean(sessionLoaded && isReady);
  const {
    data: fetchResult,
    showSkeleton,
    error: fetchError,
  } = useHydratedSupabaseFetch(
    fetcher,
    [refreshEpoch, membershipEpoch],
    {
      sessionLoaded: ready,
      userId,
      timeoutMs: 8000,
      initialData: cached || [],
      enabled: Boolean(ready && userId),
    }
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
    if (!userId) return;
    try {
      sessionStorage.removeItem(`${CACHE_KEY}:${userId}`);
    } catch {}
  }, [membershipEpoch, userId]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    if (showSkeleton) {
      setLoading(true);
      return;
    }
    setLoading(false);
  }, [showSkeleton]);

  useEffect(() => {
    if (!fetchResult) return;
    setClubs(fetchResult.clubs || []);
    cachedRef.current = fetchResult.clubs || [];
    writeCache(fetchResult.userId, fetchResult.clubs || []);
    setError(null);
  }, [fetchResult]);

  useEffect(() => {
    if (!fetchError || fetchError.message === "no-user") return;
    setError(fetchError);
    setLoading(false);
  }, [fetchError]);

  return { clubs, loading, error };
}
