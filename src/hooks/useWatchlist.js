// src/hooks/useWatchlist.js
import { useEffect, useMemo, useState, useCallback } from "react";
import supabase from "../supabaseClient.js";
import { useUser } from "../context/UserContext";

export default function useWatchlist(userId) {
  const { user, sessionLoaded } = useUser();
  const effectiveUserId = userId || user?.id || null;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(effectiveUserId));
  const [error, setError] = useState(null);

  const fetchWatchlist = useCallback(async () => {
    if (!sessionLoaded || !effectiveUserId) return;
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("user_watchlist")
      .select("movie_id, title, poster_path")
      .eq("user_id", effectiveUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[useWatchlist] fetch error:", error);
      setError(error);
      setItems([]);
    } else {
      const mapped = (data || []).map((r) => ({
        id: Number(r.movie_id),
        title: r.title || "",
        poster_path: r.poster_path || "",
      }));
      setItems(mapped);
    }
    setLoading(false);
  }, [effectiveUserId, sessionLoaded]);

  useEffect(() => { fetchWatchlist(); }, [fetchWatchlist]);

  // Realtime refresh
  useEffect(() => {
    if (!sessionLoaded || !effectiveUserId) return;
    const channel = supabase
      .channel(`watchlist:${effectiveUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_watchlist", filter: `user_id=eq.${effectiveUserId}` },
        () => fetchWatchlist()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [effectiveUserId, fetchWatchlist, sessionLoaded]);

  // Retry after a token refresh/sign-in so stale JWTs never freeze the UI
  useEffect(() => {
    const { data: auth } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setItems([]);
        setLoading(false);
        return;
      }
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        if (session?.user?.id && session.user.id === effectiveUserId) {
          fetchWatchlist();
        }
      }
    });
    return () => auth?.subscription?.unsubscribe();
  }, [effectiveUserId, fetchWatchlist]);

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

      setItems((prev) => [
        { id: row.movie_id, title: row.title, poster_path: row.poster_path },
        ...prev.filter((m) => m.id !== row.movie_id),
      ]);

      const { error } = await supabase.from("user_watchlist").insert(row);
      if (error) {
        console.warn("[useWatchlist] insert error:", error);
        await fetchWatchlist(); // rollback by refetch
        return { error };
      }
      return { ok: true };
    },
    [user?.id, fetchWatchlist]
  );

  // Remove item (current signed-in user only)
  const remove = useCallback(
    async (movieId) => {
      if (!user?.id || !movieId) {
        const err = "not-auth-or-bad-input";
        console.warn("[useWatchlist] remove aborted:", err, { user: !!user?.id, movieId });
        return { error: err };
      }

      setItems((prev) => prev.filter((m) => m.id !== Number(movieId)));

      const { error } = await supabase
        .from("user_watchlist")
        .delete()
        .eq("user_id", user.id)
        .eq("movie_id", Number(movieId));

      if (error) {
        console.warn("[useWatchlist] delete error:", error);
        await fetchWatchlist();
        return { error };
      }
      return { ok: true };
    },
    [user?.id, fetchWatchlist]
  );

  return useMemo(
    () => ({ items, loading, error, refresh: fetchWatchlist, add, remove }),
    [items, loading, error, fetchWatchlist, add, remove]
  );
}
