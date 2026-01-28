// src/hooks/useWatchlist.js
import { useEffect, useMemo, useState, useCallback } from "react";
import supabase from "lib/supabaseClient";
import { useUser } from "../context/UserContext";
import useHydratedSupabaseFetch from "./useHydratedSupabaseFetch";
import { readCache, writeCache } from "../lib/cache";
import isAbortError from "lib/isAbortError";

const WATCHLIST_CACHE_TTL = 10 * 60 * 1000;

export default function useWatchlist(userId, options = {}) {
  const { user, sessionLoaded } = useUser();
  const effectiveUserId = userId || user?.id || null;
  const {
    realtime = true,
    useCache = false,
    refreshEpoch = 0,
  } = options || {};

  const cacheKey = useCache && effectiveUserId ? `sf.watchlist.cache.v1:${effectiveUserId}` : null;
  const initialCache = useMemo(() => {
    if (!cacheKey) return null;
    return readCache(cacheKey, WATCHLIST_CACHE_TTL);
  }, [cacheKey]);

  const [items, setItems] = useState(initialCache || []);
  const [error, setError] = useState(null);
  const watchlistFetchEnabled = Boolean(effectiveUserId && sessionLoaded);

  const cacheItems = useCallback(
    (next) => {
      if (!cacheKey) return;
      writeCache(cacheKey, next);
    },
    [cacheKey]
  );

  const {
    data: fetchResult,
    error: fetchError,
    timedOut,
    retry,
    showSkeleton,
  } = useHydratedSupabaseFetch(
    async () => {
      if (!user?.id || !effectiveUserId) return [];
      const { data, error } = await supabase
        .from("user_watchlist")
        .select("movie_id, title, poster_path")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    [refreshEpoch],
    {
      sessionLoaded,
      userId: effectiveUserId || null,
      timeoutMs: 8000,
      initialData: initialCache || [],
      enabled: watchlistFetchEnabled,
      refreshEpoch,
    }
  );

  useEffect(() => {
    if (!Array.isArray(fetchResult)) return;
    const mapped = fetchResult.map((row) => ({
      id: Number(row.movie_id),
      title: row.title || "",
      poster_path: row.poster_path || "",
    }));
    setItems(mapped);
    cacheItems(mapped);
    setError(null);
  }, [fetchResult, cacheItems]);

  useEffect(() => {
    if (!fetchError || isAbortError(fetchError)) return;
    if (fetchError.message !== "no-user") {
      setError(fetchError);
    }
  }, [fetchError]);

  useEffect(() => {
    if (!timedOut) return;
    setError((prev) => prev || new Error("Watchlist loading timed out"));
  }, [timedOut]);

  useEffect(() => {
    if (!realtime || !watchlistFetchEnabled || !effectiveUserId) return;
    const channel = supabase
      .channel(`watchlist:${effectiveUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_watchlist",
        },
        () => retry()
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [effectiveUserId, realtime, retry, watchlistFetchEnabled]);

  useEffect(() => {
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setItems([]);
        if (cacheKey) cacheItems([]);
      }
    });
    return () => auth?.subscription?.unsubscribe();
  }, [cacheKey, effectiveUserId, cacheItems]);

  const watchlistLoading = showSkeleton && !items.length;

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
        await retry();
        return { error };
      }
      return { ok: true };
    },
    [user?.id, retry, cacheItems]
  );

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
    () => ({ items, loading: watchlistLoading, error, refresh: retry, add, remove }),
    [items, watchlistLoading, error, retry, add, remove]
  );
}
