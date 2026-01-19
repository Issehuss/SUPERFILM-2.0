import { useState } from "react";
import useNotifications from "../hooks/useNotifications";
import { Link } from "react-router-dom";
import supabase from "../supabaseClient";

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
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [hiddenIds, setHiddenIds] = useState(() => new Set());

  const handleMarkAllClick = () => {
    if (!confirmingAll) {
      setConfirmingAll(true);
      return;
    }
    markAllAsRead();
    setConfirmingAll(false);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 md:px-6 py-8 text-white">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <div className="flex items-center gap-2">
          {confirmingAll && (
            <>
              <button
                type="button"
                onClick={() => setConfirmingAll(false)}
                className="text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/15"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMarkAllClick}
                className="text-xs px-3 py-1 rounded-full bg-yellow-500 text-black hover:bg-yellow-400"
              >
                Confirm
              </button>
            </>
          )}
          {!confirmingAll && (
            <button
              type="button"
              onClick={handleMarkAllClick}
              className="text-sm text-yellow-400 hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl bg-white/5 ring-1 ring-white/10">
        {loading && !items.length ? (
          <div className="p-6 text-zinc-400 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-zinc-400 text-sm">No notifications yet.</div>
        ) : (
          <ul className="divide-y divide-white/10">
            {items.filter((n) => !hiddenIds.has(n.id)).map((n) => {
              const d = n.data || {};
              const clubName = d.club_name || d.group_name || d.chat_name || d.title || "Club chat";
              const snippet = d.snippet || d.message || d.summary || "";
              const href = resolveNotificationHref(n);
              const isPwa = n.type?.startsWith("pwa.install");
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
                try {
                  localStorage.setItem("sf:pwa-installed", "1");
                } catch {}
              };
              return (
                <li key={n.id} className={`p-5 ${!n.read_at ? "bg-white/[0.03]" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {isPwa
                          ? "Install SuperFilm PWA"
                          : n.type.startsWith("chat.mention")
                          ? `Mention in ${clubName}`
                          : n.type.startsWith("chat.new")
                          ? `New messages in ${clubName}`
                          : d.title || clubName}
                      </div>
                      {snippet && <div className="text-sm text-zinc-400 mt-1">{snippet}</div>}
                      {isPwa && d.question && (
                        <div className="text-xs text-zinc-500 mt-1">{d.question}</div>
                      )}
                      {isPwa && (
                        <button
                          type="button"
                          onClick={dismissPwa}
                          className="mt-2 inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-white/15"
                        >
                          Yes, installed
                        </button>
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
