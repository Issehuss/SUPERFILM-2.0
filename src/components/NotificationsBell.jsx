// src/components/NotificationsBell.jsx
import { useContext, useRef, useState, useEffect, useMemo } from "react";
import {
  Bell,
  CheckCheck,
  CalendarClock,
  AtSign,
  MessageSquare,
  Crown,
  UserPlus,
  Users as UsersIcon,
  Download,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import useNotifications from "../hooks/useNotifications";
import { useUser } from "../context/UserContext";
import supabase from "lib/supabaseClient";
import { markPwaInstalled } from "../constants/pwaInstall";
import usePageVisibility from "../hooks/usePageVisibility";
import { HomeRefreshContext } from "../pages/HomeSignedIn";

function timeAgo(date) {
  try {
    const d = new Date(date);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

function typeIcon(type) {
  if (type?.startsWith("chat.mention")) return <AtSign size={16} className="shrink-0" />;
  if (type?.startsWith("chat.new")) return <MessageSquare size={16} className="shrink-0" />;
  if (type?.startsWith("club.membership")) return <UsersIcon size={16} className="shrink-0" />;
  if (type?.startsWith("club.role")) return <Crown size={16} className="shrink-0" />;
  if (type?.startsWith("profile.follow")) return <UserPlus size={16} className="shrink-0" />;
  if (type?.startsWith("screening.")) return <CalendarClock size={16} className="shrink-0" />;
  if (type?.startsWith("pwa.install")) return <Download size={16} className="shrink-0" />;
  return <Bell size={16} className="shrink-0" />;
}

function resolveNotificationHref(notification) {
  const d = notification?.data || {};
  if (notification?.type?.startsWith("pwa.install")) {
    return "/pwa";
  }
  if (notification?.type?.startsWith("club.membership.pending")) {
    const clubParam = d.slug || d.club_slug || notification?.club_id;
    return clubParam ? `/clubs/${clubParam}/requests` : "/notifications";
  }
  if (d.href) return d.href;
  if (d.chat_path) return d.chat_path;
  if (d.slug) return `/clubs/${d.slug}/chat`;
  if (notification?.club_id) return `/clubs/${notification.club_id}/chat`;
  return "/notifications";
}

export default function NotificationsBell() {
  const { user, sessionLoaded } = useUser();
  const homeRefreshEpoch = useContext(HomeRefreshContext);
  const [open, setOpen] = useState(false);
  const {
    items,
    unread,
    adminPending,
    adminPendingLoading,
    adminPendingError,
    markAllAsRead,
    markItemRead,
  } = useNotifications({ refreshEpoch: homeRefreshEpoch, adminPendingOpen: open });
  const ref = useRef(null);
  const navigate = useNavigate();
  const isVisible = usePageVisibility();
  const [syntheticItems, setSyntheticItems] = useState([]);
  const [syntheticUnread, setSyntheticUnread] = useState(0);
  const [hiddenIds, setHiddenIds] = useState(() => new Set());

  const [adminClubs, setAdminClubs] = useState([]);
  const adminClubIds = useMemo(
    () => adminClubs.map((c) => c.club_id).filter(Boolean),
    [adminClubs]
  );
  const adminClubIdsKey = adminClubIds.join(",");
  const loadingAdminPendingVisible = open ? adminPendingLoading : false;

  useEffect(() => {
    if (!open) {
      setAdminClubs([]);
      return;
    }
    setAdminClubs(adminPending);
  }, [open, adminPending]);

  // Close on outside click
  useEffect(() => {
    function onClick(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (adminPendingError && adminPendingError.message !== "no-user") {
      console.warn("[NotificationsBell] admin pending error:", adminPendingError);
      setAdminClubs([]);
    }
  }, [open, adminPendingError]);

  // Live updates to pending counts while panel open
  useEffect(() => {
    if (!open || !isVisible || adminClubs.length === 0 || !sessionLoaded) return;
    let cancelled = false;
    let retryTimer;
    let channel;

    const subscribe = async () => {
      const { data: auth } = await supabase.auth.getSession();
      const sessionUserId = auth?.session?.user?.id || null;
      const resolvedUserId = user?.id || sessionUserId;
      if (!resolvedUserId) {
        if (!cancelled) retryTimer = setTimeout(subscribe, 500);
        return;
      }

      const clubIds = adminClubIds;
      channel = supabase
        .channel(`pending-requests:${resolvedUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "membership_requests" },
        (payload) => {
          if (clubIds.includes(payload.new.club_id) && payload.new.status === "pending") {
            setAdminClubs((prev) =>
              prev.map((c) =>
                c.club_id === payload.new.club_id ? { ...c, pending: c.pending + 1 } : c
              )
            );

            // also push a synthetic notification so the bell shows it even if RLS blocks inserts
            setSyntheticItems((prev) => [
              {
                id: `synthetic-${payload.new.id}`,
                type: "club.membership.pending",
                club_id: payload.new.club_id,
                created_at: payload.new.created_at || new Date().toISOString(),
                data: {
                  message: "New membership request",
                  href: `/clubs/${adminClubs.find((c) => c.club_id === payload.new.club_id)?.slug || payload.new.club_id}/requests`,
                },
              },
              ...prev,
            ]);
            setSyntheticUnread((u) => Math.min(99, (u || 0) + 1));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "membership_requests" },
        (payload) => {
          if (clubIds.includes(payload.new.club_id)) {
            if (payload.old?.status === "pending" && payload.new.status !== "pending") {
              setAdminClubs((prev) =>
                prev.map((c) =>
                  c.club_id === payload.new.club_id
                    ? { ...c, pending: Math.max(0, c.pending - 1) }
                    : c
                )
              );

              setSyntheticItems((prev) => prev.filter((n) => n.id !== `synthetic-${payload.new.id}`));
              setSyntheticUnread((u) => Math.max(0, (u || 0) - 1));
            }
          }
        }
      )
      .subscribe();
    };

    subscribe();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }, [open, user?.id, sessionLoaded, adminClubs, adminClubIds, adminClubIdsKey, homeRefreshEpoch, isVisible]);

  // 🔒 If not signed in, hide bell entirely (no markup rendered)
  if (!user) return null;

  const mergedItems = [...syntheticItems, ...items]
    .filter((n) => !hiddenIds.has(n.id))
    .sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const totalUnread = (unread || 0) + (syntheticUnread || 0);

  const dismissPwa = async (e, n) => {
    e.stopPropagation();
    if (!n?.id || n.id?.startsWith("synthetic-")) return;
    const now = new Date().toISOString();
    try {
      await supabase
        .from("notifications")
        .update({
          read_at: now,
          seen_at: now,
          data: { ...(n.data || {}), dismissed: true, dismissed_at: now },
        })
        .eq("id", n.id);
    } catch {}
    await markItemRead(n.id);
    setHiddenIds((prev) => new Set(prev).add(n.id));
    markPwaInstalled();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          `relative inline-flex items-center justify-center h-9 w-9 rounded-full
           bg-white/10 hover:bg-white/15 ring-1 ring-white/10`
        }
        
        aria-label="Open notifications"
      >
        <Bell size={18} />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-yellow-500 text-black text-[11px] font-bold ring-2 ring-black">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[92vw] max-w-[360px] max-h-[70vh] overflow-auto rounded-2xl bg-black/90 backdrop-blur ring-1 ring-white/10 shadow-2xl left-1/2 -translate-x-1/2 sm:left-auto sm:-translate-x-0 sm:w-[360px]"
          role="listbox"
          aria-label="Notifications"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-black/90 backdrop-blur rounded-t-2xl border-b border-white/10">
            <div className="text-sm font-semibold">Notifications</div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 text-xs text-yellow-400 hover:underline"
              >
                <CheckCheck size={14} /> Mark all as read
              </button>
            )}
          </div>

          {/* ADMIN: Membership Requests shortcut (inside panel) */}
          {!loadingAdminPendingVisible && adminClubs.some((c) => c.pending > 0) && (
            <div className="px-4 py-3 border-b border-white/10">
              <div className="text-xs uppercase tracking-wide text-zinc-400 mb-2">Requests</div>
              <ul className="space-y-2">
                {adminClubs
                  .filter((c) => c.pending > 0)
                  .map((c) => (
                    <li key={c.club_id} className="flex items-center justify-between">
                      <Link
                        to={`/clubs/${c.slug || c.club_id}/requests`}
                        onClick={() => setOpen(false)}
                        className="text-sm hover:underline"
                      >
                        {c.name}
                      </Link>
                      <Link
                        to={`/clubs/${c.slug || c.club_id}/requests`}
                        onClick={() => setOpen(false)}
                        className="text-xs inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 hover:bg-white/15"
                        aria-label={`Open membership requests for ${c.name}`}
                      >
                        Pending
                        <span className="ml-1 inline-flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-yellow-500 text-black font-bold">
                          {c.pending > 99 ? "99+" : c.pending}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* User notifications list */}
          {mergedItems.length === 0 ? (
            <div className="px-4 py-10 text-sm text-zinc-400">You’re all caught up.</div>
          ) : (
            <ul className="divide-y divide-white/10">
          {mergedItems.slice(0, 7).map((n) => {
                const isUnread = !n.read_at && !n.id?.startsWith("synthetic-");
                const d = n.data || {};
                const isPwa = n.type?.startsWith("pwa.install");
                const clubName =
                  d.club_name || d.group_name || d.chat_name || d.title || "Club chat";
                const snippet = d.snippet || d.message || d.summary || "";
                const href = resolveNotificationHref(n);

                return (
                  <li
                    key={n.id}
                    className={`px-4 py-3 text-sm ${isUnread ? "bg-white/[0.03]" : ""}`}
                    onClick={async () => {
                      if (!n.id?.startsWith("synthetic-")) {
                        await markItemRead(n.id);
                      }
                      setOpen(false);
                      navigate(href);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-[2px] ${isUnread ? "text-yellow-400" : "text-zinc-400"}`}>
                        {typeIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`truncate ${isUnread ? "font-semibold" : "font-medium"}`}>
                          {isPwa
                            ? "Install SuperFilm PWA"
                            : n.type?.startsWith("chat.mention")
                            ? `Mention in ${clubName}`
                            : n.type?.startsWith("chat.new")
                            ? `New messages in ${clubName}`
                            : d.title || clubName}
                        </div>
                        {snippet && <div className="truncate text-zinc-400">{snippet}</div>}
                        {isPwa && d.question && (
                          <div className="mt-1 text-xs text-zinc-400">{d.question}</div>
                        )}
                        <div className="text-xs text-zinc-500 mt-0.5">{timeAgo(n.created_at)}</div>
                        {isPwa && (
                          <button
                            type="button"
                            onClick={(e) => dismissPwa(e, n)}
                            className="mt-2 inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/15"
                          >
                            Yes, installed
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer */}
          <div className="px-4 py-3 border-t border-white/10">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-sm text-yellow-400 hover:underline"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
