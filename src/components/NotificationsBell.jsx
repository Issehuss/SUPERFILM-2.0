// src/components/NotificationsBell.jsx
import { useRef, useState, useEffect } from "react";
import {
  Bell,
  CheckCheck,
  CalendarClock,
  AtSign,
  MessageSquare,
  Crown,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import useNotifications from "../hooks/useNotifications";
import { useUser } from "../context/UserContext";
import supabase from "../supabaseClient";

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
  return <Bell size={16} className="shrink-0" />;
}

const REQUEST_ROLES = ["president"]; // who can see & act on membership requests

export default function NotificationsBell() {
  const { user } = useUser();
  const { items, unread, markAllAsRead, markItemRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const [syntheticItems, setSyntheticItems] = useState([]);
  const [syntheticUnread, setSyntheticUnread] = useState(0);

  // Admin/Staff clubs with pending join requests
  const [adminClubs, setAdminClubs] = useState([]); // [{club_id, name, slug, pending}]
  const [loadingAdminPending, setLoadingAdminPending] = useState(true);

  // Close on outside click
  useEffect(() => {
    function onClick(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Load staff clubs + pending counts when panel opens (or user changes)
  useEffect(() => {
    let cancelled = false;

    async function loadAdminPending() {
      if (!user?.id) {
        if (!cancelled) {
          setAdminClubs([]);
          setLoadingAdminPending(false);
        }
        return;
      }
      setLoadingAdminPending(true);

      // 1) clubs where user is staff (president)
      const { data: staffClubs } = await supabase
        .from("club_staff")
        .select("club_id, role, clubs:clubs!inner(id, name, slug)")
        .eq("user_id", user.id);

      let allowedClubs =
        (staffClubs || [])
          .filter((r) => REQUEST_ROLES.includes(String(r.role || "").toLowerCase()))
          .map((r) => r.clubs)
          .filter(Boolean);

      // 1b) clubs where user is member with president role
      const { data: memberPres } = await supabase
        .from("club_members")
        .select("club_id, role, clubs:clubs!inner(id, name, slug)")
        .eq("user_id", user.id)
        .eq("role", "president");

      if (memberPres?.length) {
        allowedClubs = [
          ...allowedClubs,
          ...memberPres.map((r) => r.clubs).filter(Boolean),
        ];
      }

      // Fallback: profile_roles with an array "roles"
      if (!allowedClubs.length) {
        const { data: prClubs } = await supabase
          .from("profile_roles")
          .select("club_id, roles, clubs:clubs!inner(id, name, slug)")
          .eq("user_id", user.id);

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
        if (!cancelled) {
          setAdminClubs([]);
          setLoadingAdminPending(false);
        }
        return;
      }

      // 2) pending counts per club
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

      // De-dupe by club_id and attach counts
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

      if (!cancelled) {
        setAdminClubs(Array.from(byId.values()).sort((a, b) => b.pending - a.pending));
        setLoadingAdminPending(false);
      }
    }

    if (open) loadAdminPending();
    return () => {
      cancelled = true;
    };
  }, [user?.id, open]);

  // Live updates to pending counts while panel open
  useEffect(() => {
    if (!open || !user?.id || adminClubs.length === 0) return;

    const clubIds = adminClubs.map((c) => c.club_id);
    const channel = supabase
      .channel(`pending-requests:${user.id}`)
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

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [open, user?.id, adminClubs.map((c) => c.club_id).join(",")]);

  // 🔒 If not signed in, hide bell entirely (no markup rendered)
  if (!user) return null;

  const mergedItems = [...syntheticItems, ...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const totalUnread = (unread || 0) + (syntheticUnread || 0);

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
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-yellow-400 ring-2 ring-black" />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[360px] max-h-[70vh] overflow-auto rounded-2xl bg-black/90 backdrop-blur ring-1 ring-white/10 shadow-2xl"
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
          {!loadingAdminPending && adminClubs.some((c) => c.pending > 0) && (
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
              {mergedItems.slice(0, 12).map((n) => {
                const isUnread = !n.read_at && !n.id?.startsWith("synthetic-");
                const d = n.data || {};
                const clubName =
                  d.club_name || d.group_name || d.chat_name || d.title || "Club chat";
                const snippet = d.snippet || d.message || d.summary || "";
                const href =
                  d.href ||
                  (d.chat_path
                    ? d.chat_path
                    : d.slug
                    ? `/clubs/${d.slug}/chat`
                    : n.club_id
                    ? `/clubs/${n.club_id}/chat`
                    : "/");

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
                          {n.type?.startsWith("chat.mention")
                            ? `Mention in ${clubName}`
                            : n.type?.startsWith("chat.new")
                            ? `New messages in ${clubName}`
                            : d.title || clubName}
                        </div>
                        {snippet && <div className="truncate text-zinc-400">{snippet}</div>}
                        <div className="text-xs text-zinc-500 mt-0.5">{timeAgo(n.created_at)}</div>
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
