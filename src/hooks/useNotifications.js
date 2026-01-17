import { useEffect, useMemo, useState, useCallback } from "react";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";

export default function useNotifications({ pageSize = 20 } = {}) {
  const { user } = useUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);

  const userId = user?.id;

  const fetchPage = useCallback(async (cursorCreatedAt = null) => {
    if (!userId) return { rows: [], cursor: null };

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
    };
  }, [userId, pageSize]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { rows, cursor } = await fetchPage(null);
      setItems(rows);
      setNextCursor(cursor);

      // unread count
      const { count: unreadCount, error: unreadErr } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);
      if (!unreadErr) setUnread(unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, [userId, fetchPage]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notif:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new;
          setItems((prev) => [row, ...prev]);
          setUnread((u) => Math.min(99, (u || 0) + 1));
        }
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [userId]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString(), seen_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString(), seen_at: n.seen_at ?? new Date().toISOString() })));
  }, [userId]);

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
    const { rows, cursor } = await fetchPage(nextCursor);
    setItems((prev) => [...prev, ...rows]);
    setNextCursor(cursor);
  }, [fetchPage, nextCursor]);

  return {
    items,
    loading,
    unread,
    refresh,
    markAllAsRead,
    markItemRead,
    loadMore,
    hasMore: !!nextCursor,
  };
}
