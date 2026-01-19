import { useEffect, useMemo, useState, useCallback } from "react";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";
import useRealtimeResume from "./useRealtimeResume";
import useSafeSupabaseFetch from "./useSafeSupabaseFetch";
import useAppResume from "./useAppResume";

const NOTIF_CACHE_TTL_MS = 5 * 60 * 1000;
const notifCacheKey = (userId) => `sf.notifications.v1:${userId}`;

const readNotifCache = (userId) => {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(notifCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !Array.isArray(parsed?.data)) return null;
    if (Date.now() - parsed.ts > NOTIF_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeNotifCache = (userId, data) => {
  if (!userId || !Array.isArray(data)) return;
  try {
    localStorage.setItem(
      notifCacheKey(userId),
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {
    /* ignore */
  }
};

export default function useNotifications({ pageSize = 20 } = {}) {
  const { user } = useUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const resumeTick = useRealtimeResume();
  const appResumeTick = useAppResume();
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchPage = useCallback(async (userId, cursorCreatedAt = null) => {
    if (!userId) return { rows: [], cursor: null, userId: null };

    let query = supabase
      .from("notifications")
      .select("id, type, actor_id, club_id, data, created_at, seen_at, read_at", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(pageSize);

    if (cursorCreatedAt) {
      query = query.lt("created_at", cursorCreatedAt);
    }

    const { data, error } = await query;
    if (error) throw error;
    return {
      rows: data || [],
      cursor: (data && data.length) ? data[data.length - 1].created_at : null,
      userId,
    };
  }, [pageSize]);

  const { data: refreshResult, loading: refreshLoading, error: refreshError, timedOut, retry } =
    useSafeSupabaseFetch(
      async (session) => {
        const userId = user?.id || session?.user?.id;
        const cached = readNotifCache(userId);
        if (cached?.length) {
          setItems(cached);
          setLoading(false);
        }
        const { rows, cursor } = await fetchPage(userId, null);
        const { data: counterRow } = await supabase
          .from("user_notification_counters")
          .select("unread_count")
          .eq("user_id", userId)
          .maybeSingle();
        return {
          userId,
          rows,
          cursor,
          unread: counterRow?.unread_count ?? 0,
        };
      },
      [refreshKey, user?.id, appResumeTick],
      { enabled: true, timeoutMs: 8000 }
    );

  useEffect(() => {
    setLoading(refreshLoading);
  }, [refreshLoading]);

  // Realtime subscription for new notifications
  useEffect(() => {
    let cancelled = false;
    let channel;
    let retryTimer;

    const subscribe = async () => {
      const { data: auth } = await supabase.auth.getSession();
      const sessionUserId = auth?.session?.user?.id || null;
      const resolvedUserId = user?.id || sessionUserId;
      if (!resolvedUserId) {
        if (!cancelled) retryTimer = setTimeout(subscribe, 500);
        return;
      }
      channel = supabase
        .channel(`notif:${resolvedUserId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${resolvedUserId}` },
          (payload) => {
            const row = payload.new;
            setItems((prev) => {
              const next = [row, ...prev];
              writeNotifCache(resolvedUserId, next);
              return next;
            });
            setUnread((u) => Math.min(99, (u || 0) + 1));
          }
        )
        .subscribe();
    };

    subscribe();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) {
        try { supabase.removeChannel(channel); } catch {}
      }
    };
  }, [user?.id, resumeTick]);

  const markAllAsRead = useCallback(async () => {
    const { data: auth } = await supabase.auth.getSession();
    const sessionUserId = auth?.session?.user?.id || null;
    const userId = user?.id || sessionUserId;
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString(), seen_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString(), seen_at: n.seen_at ?? new Date().toISOString() })));
  }, [user?.id]);

  const markItemRead = useCallback(async (id) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString(), seen_at: new Date().toISOString() })
      .eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString(), seen_at: n.seen_at ?? new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, (u || 0) - 1));
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    const { data: auth } = await supabase.auth.getSession();
    const sessionUserId = auth?.session?.user?.id || null;
    const resolvedUserId = user?.id || sessionUserId;
    if (!resolvedUserId) return;
    const { rows, cursor } = await fetchPage(resolvedUserId, nextCursor);
    setItems((prev) => {
      const next = [...prev, ...rows];
      writeNotifCache(resolvedUserId, next);
      return next;
    });
    setNextCursor(cursor);
  }, [fetchPage, nextCursor, user?.id]);

  useEffect(() => {
    if (!refreshResult) return;
    setItems(refreshResult.rows || []);
    setNextCursor(refreshResult.cursor || null);
    setUnread(refreshResult.unread ?? 0);
    if (refreshResult.userId) writeNotifCache(refreshResult.userId, refreshResult.rows || []);
  }, [refreshResult]);

  useEffect(() => {
    if (refreshError && refreshError.message !== "no-user") {
      setError(refreshError);
    }
  }, [refreshError]);

  useEffect(() => {
    if (timedOut) {
      setError(new Error("Notifications loading timed out"));
    }
  }, [timedOut]);

  return {
    items,
    loading,
    error,
    unread,
    refresh: () => setRefreshKey((k) => k + 1),
    markAllAsRead,
    markItemRead,
    loadMore,
    hasMore: !!nextCursor,
  };
}
