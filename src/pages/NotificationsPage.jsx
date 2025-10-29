import useNotifications from "../hooks/useNotifications";
import { Link } from "react-router-dom";

export default function NotificationsPage() {
  const { items, loading, loadMore, hasMore, markItemRead, markAllAsRead } = useNotifications({ pageSize: 30 });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 md:px-6 py-8 text-white">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <button
          type="button"
          onClick={markAllAsRead}
          className="text-sm text-yellow-400 hover:underline"
        >
          Mark all as read
        </button>
      </div>

      <div className="mt-6 rounded-2xl bg-white/5 ring-1 ring-white/10">
        {loading && !items.length ? (
          <div className="p-6 text-zinc-400 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-zinc-400 text-sm">No notifications yet.</div>
        ) : (
          <ul className="divide-y divide-white/10">
            {items.map((n) => {
              const d = n.data || {};
              const clubName = d.club_name || d.group_name || d.chat_name || d.title || "Club chat";
              const snippet = d.snippet || d.message || d.summary || "";
              const href = d.href || d.chat_path || (d.slug ? `/clubs/${d.slug}/chat` : "/");
              return (
                <li key={n.id} className={`p-5 ${!n.read_at ? "bg-white/[0.03]" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {n.type.startsWith("chat.mention")
                          ? `Mention in ${clubName}`
                          : n.type.startsWith("chat.new")
                          ? `New messages in ${clubName}`
                          : d.title || clubName}
                      </div>
                      {snippet && <div className="text-sm text-zinc-400 mt-1">{snippet}</div>}
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
