// src/hooks/useWatchlist.js
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import supabase from "../supabaseClient.js";
import { useUser } from "../context/UserContext";
import useRealtimeResume from "./useRealtimeResume";
import useSafeSupabaseFetch from "./useSafeSupabaseFetch";
import useAppResume from "./useAppResume";

export default function useWatchlist(userId, options = {}) {
  const { user } = useUser();
  const effectiveUserId = userId || user?.id || null;
  const {
    auto = true,
    realtime = true,
    useCache = false,
    refreshKey = 0,
  } = options || {};

  const [items, setItems] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const fetchKeyRef = useRef(0);
  const [fetchKey, setFetchKey] = useState(0);

  const cacheKey = effectiveUserId ? `sf.watchlist.cache.v1:${effectiveUserId}` : null;
  const lastRefreshRef = useRef(refreshKey);
  const resumeTick = useRealtimeResume();
  const appResumeTick = useAppResume();
  const cacheItems = useCallback((next) => {
    if (!useCache || !cacheKey) return;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: next }));
    } catch {}
  }, [useCache, cacheKey]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const { data: fetchResult, loading, error: fetchError, timedOut, retry } = useSafeSupabaseFetch(
    async (session) => {
      const resolvedUserId = effectiveUserId || session?.user?.id;
      if (!resolvedUserId) {
        throw new Error("no-user");
      }
      const { data, error } = await supabase
        .from("user_watchlist")
        .select("movie_id, title, poster_path")
        .eq("user_id", resolvedUserId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return { userId: resolvedUserId, rows: data || [] };
    },
    [fetchKey, effectiveUserId, appResumeTick],
    { enabled: Boolean(fetchKey) || !hasLoaded, timeoutMs: 8000 }
  );

  useEffect(() => {
    if (useCache && cacheKey) {
      try {
        const raw = sessionStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.data) {
            setItems(parsed.data);
            setHasLoaded(true);
          }
        }
      } catch {}
    }
  }, [useCache, cacheKey]);

  useEffect(() => {
    const shouldForceRefresh = refreshKey !== lastRefreshRef.current;
    const shouldFetch = auto || !hasLoaded || shouldForceRefresh;
    if (!shouldFetch) return;
    fetchKeyRef.current += 1;
    setFetchKey(fetchKeyRef.current);
    if (shouldForceRefresh) lastRefreshRef.current = refreshKey;
  }, [auto, hasLoaded, refreshKey]);

  useEffect(() => {
    setHasLoaded(false);
    if (!effectiveUserId) setItems([]);
  }, [effectiveUserId]);

  // Realtime refresh
  useEffect(() => {
    if (!realtime) return;
    let cancelled = false;
    let channel;
    let retryTimer;

    const subscribe = async () => {
      const { data: auth } = await supabase.auth.getSession();
      const sessionUserId = auth?.session?.user?.id || null;
      const resolvedUserId = effectiveUserId || sessionUserId;
      if (!resolvedUserId) {
        if (!cancelled) retryTimer = setTimeout(subscribe, 500);
        return;
      }
      channel = supabase
        .channel(`watchlist:${resolvedUserId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_watchlist", filter: `user_id=eq.${resolvedUserId}` },
          () => retry()
        )
        .subscribe();
    };

    subscribe();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [effectiveUserId, realtime, resumeTick, retry]);

  useEffect(() => {
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setItems([]);
        setHasLoaded(false);
        return;
      }
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        if (session?.user?.id && (!effectiveUserId || session.user.id === effectiveUserId)) {
          retry();
        }
      }
    });
    return () => auth?.subscription?.unsubscribe();
  }, [effectiveUserId, retry]);

  useEffect(() => {
    if (!fetchResult) return;
    const mapped = (fetchResult.rows || []).map((r) => ({
      id: Number(r.movie_id),
      title: r.title || "",
      poster_path: r.poster_path || "",
    }));
    setItems(mapped);
    cacheItems(mapped);
    setHasLoaded(true);
    setError(null);
  }, [fetchResult, cacheItems]);

  useEffect(() => {
    if (fetchError && fetchError.message !== "no-user") {
      setError(fetchError);
      setItems([]);
      setHasLoaded(true);
    }
  }, [fetchError]);

  useEffect(() => {
    if (timedOut && !hasLoaded) {
      setError(new Error("Watchlist loading timed out"));
    }
  }, [timedOut, hasLoaded]);

  // Add item (current signed-in user only)
  const add = useCallback(
    async (movie) => {
      if (!user?.id || !movie?.id) {
        const err = "not-auth-or-bad-input";
        console.warn("[useWatchlist] add aborted:", err, { user: !!user?.id, movie });
        return { error: err };
      }

      const row = {
        user_id: user.id,
        movie_id: Number(movie.id),
        title: movie.title || "",
        poster_path: movie.poster_path || movie.posterPath || "",
      };

      setItems((prev) => {
        const next = [
          { id: row.movie_id, title: row.title, poster_path: row.poster_path },
          ...prev.filter((m) => m.id !== row.movie_id),
        ];
        cacheItems(next);
        return next;
      });

      const { error } = await supabase.from("user_watchlist").insert(row);
      if (error) {
        console.warn("[useWatchlist] insert error:", error);
        await retry(); // rollback by refetch
        return { error };
      }
      return { ok: true };
    },
    [user?.id, retry, cacheItems]
  );

  // Remove item (current signed-in user only)
  const remove = useCallback(
    async (movieId) => {
      if (!user?.id || !movieId) {
        const err = "not-auth-or-bad-input";
        console.warn("[useWatchlist] remove aborted:", err, { user: !!user?.id, movieId });
        return { error: err };
      }

      setItems((prev) => {
        const next = prev.filter((m) => m.id !== Number(movieId));
        cacheItems(next);
        return next;
      });

      const { error } = await supabase
        .from("user_watchlist")
        .delete()
        .eq("user_id", user.id)
        .eq("movie_id", Number(movieId));

      if (error) {
        console.warn("[useWatchlist] delete error:", error);
        await retry();
        return { error };
      }
      return { ok: true };
    },
    [user?.id, retry, cacheItems]
  );

  return useMemo(
    () => ({ items, loading, error, refresh: retry, add, remove }),
    [items, loading, error, retry, add, remove]
  );
}
