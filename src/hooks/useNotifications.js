import { useEffect, useState, useCallback, useRef } from "react";
import supabase from "lib/supabaseClient";
import { useUser } from "../context/UserContext";
import useRealtimeResume from "./useRealtimeResume";
import useSafeSupabaseFetch from "./useSafeSupabaseFetch";

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

const REQUEST_ROLES = ["president"];

export default function useNotifications({ pageSize = 20, refreshEpoch = 0, adminPendingOpen = false } = {}) {
  const { user, sessionLoaded, isReady } = useUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const resumeTick = useRealtimeResume();
  const [refreshKey, setRefreshKey] = useState(0);
  const inFlightRef = useRef(false);
  const fetchKeyRef = useRef(0);
  const [fetchKey, setFetchKey] = useState(0);
  const readyToFetch = Boolean(user?.id && sessionLoaded);
  const adminPendingEnabled = adminPendingOpen && Boolean(user?.id && sessionLoaded && isReady);

  const fetchAdminPending = useCallback(async () => {
    const resolvedUserId = user?.id;
    if (!resolvedUserId) throw new Error("no-user");

    // staff roles on club_members
    const { data: staffRows } = await supabase
      .from("club_members")
      .select("club_id, user_id, role, joined_at, accepted")
      .eq("user_id", resolvedUserId)
      .in("role", REQUEST_ROLES);

    let allowedClubs = [];
    const staffClubIds = (staffRows || []).map((r) => r.club_id).filter(Boolean);
    if (staffClubIds.length) {
      const { data: staffClubs } = await supabase
        .from("clubs_public")
        .select("id, name, slug")
        .in("id", staffClubIds);
      allowedClubs = (staffClubs || []).filter(Boolean);
    }

    // also include member presidential roles
    const { data: memberPres } = await supabase
      .from("club_members")
      .select("club_id, user_id, role, joined_at, accepted")
      .eq("user_id", resolvedUserId)
      .eq("role", "president");

    if (memberPres?.length) {
      const memberClubIds = memberPres.map((r) => r.club_id).filter(Boolean);
      if (memberClubIds.length) {
        const { data: memberClubs } = await supabase
          .from("clubs_public")
          .select("id, name, slug")
          .in("id", memberClubIds);
        if (memberClubs?.length) {
          allowedClubs = [...allowedClubs, ...memberClubs];
        }
      }
    }

    if (!allowedClubs.length) {
      const { data: prClubs } = await supabase
        .from("profile_roles")
        .select("club_id, roles, clubs:clubs!inner(id, name, slug)")
        .eq("user_id", resolvedUserId);

      allowedClubs =
        (prClubs || [])
          .filter((r) => {
            const rs = Array.isArray(r.roles)
              ? r.roles.map((x) => String(x).toLowerCase())
              : [];
            return rs.some((x) => REQUEST_ROLES.includes(x));
          })
          .map((r) => r.clubs)
          .filter(Boolean);
    }

    if (!allowedClubs.length) {
      return [];
    }

    const clubIds = allowedClubs.map((c) => c.id);
    const { data: pendingRows } = await supabase
      .from("membership_requests")
      .select("club_id, status")
      .in("club_id", clubIds)
      .eq("status", "pending");

    const counts = {};
    (pendingRows || []).forEach((r) => {
      counts[r.club_id] = (counts[r.club_id] || 0) + 1;
    });

    const byId = new Map();
    allowedClubs.forEach((c) => {
      if (!byId.has(c.id)) {
        byId.set(c.id, {
          club_id: c.id,
          name: c.name,
          slug: c.slug,
          pending: counts[c.id] || 0,
        });
      }
    });

    return Array.from(byId.values()).sort((a, b) => b.pending - a.pending);
  }, [user?.id]);

  const {
    data: adminPendingResult,
    loading: adminPendingLoading,
    error: adminPendingError,
  } = useSafeSupabaseFetch(
    fetchAdminPending,
    [adminPendingOpen, user?.id, refreshEpoch],
    {
      enabled: adminPendingEnabled,
      timeoutMs: 8000,
      initialData: [],
    }
  );

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

  const { data: refreshResult, loading: refreshLoading, error: refreshError, timedOut } =
    useSafeSupabaseFetch(
      async () => {
        const userId = user?.id;
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
      [refreshKey, user?.id, fetchKey],
      { enabled: readyToFetch, timeoutMs: 8000 }
    );

  useEffect(() => {
    if (!user?.id || !sessionLoaded) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    fetchKeyRef.current += 1;
    setFetchKey(fetchKeyRef.current);
  }, [user?.id, sessionLoaded, refreshEpoch, refreshKey]);

  useEffect(() => {
    setLoading(refreshLoading);
  }, [refreshLoading]);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!readyToFetch || !user?.id) return;
    let cancelled = false;
    let channel;
    let retryTimer;
    let idleHandle;

    const subscribe = async () => {
      if (cancelled || !readyToFetch) return;
      const { data: auth } = await supabase.auth.getSession();
      const sessionUserId = auth?.session?.user?.id || null;
      const resolvedUserId = user?.id || sessionUserId;
      if (!resolvedUserId) {
        if (!cancelled) retryTimer = window.setTimeout(() => subscribe(), 500);
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

    const scheduleSubscribe = () => {
      if (typeof window === "undefined") {
        retryTimer = setTimeout(() => subscribe(), 0);
        return;
      }
      if ("requestIdleCallback" in window) {
        idleHandle = window.requestIdleCallback(() => {
          subscribe();
          idleHandle = null;
        }, { timeout: 2000 });
      } else {
        idleHandle = window.setTimeout(() => subscribe(), 50);
      }
    };

    scheduleSubscribe();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
      if (idleHandle != null) {
        if (typeof window !== "undefined" && "cancelIdleCallback" in window) {
          window.cancelIdleCallback(idleHandle);
        } else {
          clearTimeout(idleHandle);
        }
      }
    };
  }, [user?.id, resumeTick, readyToFetch]);

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
    inFlightRef.current = false;
  }, [refreshResult]);

  useEffect(() => {
    if (refreshError && refreshError.message !== "no-user") {
      setError(refreshError);
    }
    inFlightRef.current = false;
  }, [refreshError]);

  useEffect(() => {
    if (timedOut) {
      setError(new Error("Notifications loading timed out"));
    }
    inFlightRef.current = false;
  }, [timedOut]);

  return {
    items,
    loading,
    error,
    unread,
    adminPending: adminPendingResult || [],
    adminPendingLoading,
    adminPendingError,
    refresh: () => setRefreshKey((k) => k + 1),
    markAllAsRead,
    markItemRead,
    loadMore,
    hasMore: !!nextCursor,
  };
}
