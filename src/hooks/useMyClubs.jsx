import { useEffect, useRef, useState, useCallback } from 'react';
import supabase from '../supabaseClient';
import { useUser } from '../context/UserContext';

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
  const { user, sessionLoaded } = useUser();
  const userId = userIdOverride || user?.id || null;
  const cached = readCache(userId);

  const [clubs, setClubs] = useState(cached || []);
  const [loading, setLoading] = useState(() => !!userId && !cached);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const loadClubs = useCallback(async () => {
    const cachedClubs = readCache(userId);
    if (cachedClubs?.length) setClubs(cachedClubs);

    if (!sessionLoaded) {
      // Keep showing skeletons until the JWT is restored
      setLoading((prev) => prev || (!!userId && !cachedClubs));
      return;
    }

    if (!userId) {
      setClubs([]);
      setLoading(false);
      return;
    }

    // Only show loading states when we don't already have cached data
    setLoading((prev) => prev || !cachedClubs);
    setError(null);

    // Join memberships -> clubs; alias nested select as "club"
    const { data, error } = await supabase
      .from('club_members')
      .select(`
        role,
        club:clubs (
          id, slug, name, profile_image_url, banner_url, image_url, avatar_url,
          next_screening:club_next_screening (
            film_title,
            screening_at,
            location
          )
        )
      `)
      .eq('user_id', userId);

    if (!mountedRef.current) return;
    if (error) {
      console.warn("[useMyClubs] membership fetch error:", error.message);
      setError(error);
      setLoading(false);
      return;
    }

    // Flatten and filter out null joins (shouldn’t happen but safe)
    const flattened = (data || [])
      .map(row => {
        const club = row.club || {};
        const nextScreening = Array.isArray(club.next_screening)
          ? club.next_screening[0]
          : club.next_screening;
        return {
          role: row.role,
          ...club,
          next_screening: nextScreening || null,
        };
      })
      .filter(c => c.id);

    let combined = flattened;

    // Fallback: include owned clubs if memberships are empty
    if (!combined.length) {
      const { data: owned, error: ownedErr } = await supabase
        .from('clubs')
        .select('id, slug, name, profile_image_url, banner_url, image_url, avatar_url')
        .eq('owner_id', userId);
      if (ownedErr) {
        console.warn("[useMyClubs] owned fetch error:", ownedErr.message);
      }
      if (!ownedErr && owned?.length) {
        combined = owned.map((c) => ({ role: "owner", ...c, next_screening: null }));
      }
    }

    setClubs(combined);
    writeCache(userId, combined);
    setLoading(false);
  }, [sessionLoaded, userId]);

  useEffect(() => {
    loadClubs();
  }, [loadClubs]);

  // Re-run when Supabase refreshes the JWT to avoid "needs refresh" blanks
  useEffect(() => {
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setClubs([]);
        setLoading(false);
        return;
      }
      const sessionUserId = session?.user?.id;
      if (!sessionUserId || sessionUserId !== userId) return;
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        loadClubs();
      }
    });

    return () => auth?.subscription?.unsubscribe();
  }, [loadClubs, userId]);

  return { clubs, loading, error };
}
