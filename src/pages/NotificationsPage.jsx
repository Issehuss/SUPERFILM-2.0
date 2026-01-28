import { useMemo, useState } from "react";
import useNotifications from "../hooks/useNotifications";
import { Link } from "react-router-dom";
import supabase from "lib/supabaseClient";
import { markPwaInstalled } from "../constants/pwaInstall";

function formatNotificationTime(dateString) {
  if (!dateString) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateString));
  } catch {
    return "";
  }
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

export default function NotificationsPage() {
  const { items, loading, loadMore, hasMore, markItemRead, markAllAsRead } = useNotifications({ pageSize: 30 });
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const visibleItems = useMemo(
    () => items.filter((n) => !hiddenIds.has(n.id)),
    [items, hiddenIds]
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 md:px-6 py-8 text-white">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={markAllAsRead}
            className="text-sm text-yellow-400 hover:underline"
          >
            Mark all as read
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-white/5 ring-1 ring-white/10">
        {loading && !items.length ? (
          <div className="p-6 text-zinc-400 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-zinc-400 text-sm">No notifications yet.</div>
        ) : (
          <ul className="divide-y divide-white/10">
            {visibleItems.map((n) => {
              const d = n.data || {};
              const clubName = d.club_name || d.group_name || d.chat_name || d.title || "Club chat";
              const snippet = d.snippet || d.message || d.summary || "";
              const href = resolveNotificationHref(n);
              const isPwa = n.type?.startsWith("pwa.install");
              const isUnread = !n.read_at;
              const timeLabel = formatNotificationTime(n.created_at);
              const dismissPwa = async (e) => {
                e.preventDefault();
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
                <li
                  key={n.id}
                  className={`p-5 transition ${
                    isUnread
                      ? "bg-white/[0.04] border-l-4 border-yellow-400/80 shadow-[0_5px_25px_rgba(250,204,21,0.15)]"
                      : "border border-transparent"
                  }`}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex flex-1 items-center gap-2">
                        <div className="font-semibold leading-tight">
                          {isPwa
                            ? "Install SuperFilm PWA"
                            : n.type.startsWith("chat.mention")
                            ? `Mention in ${clubName}`
                            : n.type.startsWith("chat.new")
                            ? `New messages in ${clubName}`
                            : d.title || clubName}
                        </div>
                        {isUnread && (
                          <span className="text-[10px] uppercase tracking-[0.5em] text-yellow-300">
                            New
                          </span>
                        )}
                      </div>
                      <Link
                        to={href}
                        onClick={() => markItemRead(n.id)}
                        className="text-sm text-yellow-400 hover:underline shrink-0"
                      >
                        Open
                      </Link>
                    </div>
                    <div className="flex flex-col gap-1">
                      {snippet && <div className="text-sm text-zinc-400">{snippet}</div>}
                      {isPwa && d.question && (
                        <div className="text-xs text-zinc-500">{d.question}</div>
                      )}
                      {isPwa && (
                        <button
                          type="button"
                          onClick={dismissPwa}
                          className="self-start inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/15"
                        >
                          Yes, installed
                        </button>
                      )}
                      {timeLabel && (
                        <div className="text-[12px] text-zinc-500">{timeLabel}</div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && (
          <div className="p-4 text-center">
            <button
              type="button"
              onClick={loadMore}
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-sm"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
