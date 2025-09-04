import React, { useState } from "react";
import { Users } from "lucide-react";

/**
 * Props:
 * - members: [{ id, name, avatarUrl, role }]
 * - totalCount: number
 * - isMember: boolean (viewer membership)
 * - canJoin: boolean
 * - joinDisabled?: boolean  // NEW (optional) - disable while async in flight
 * - onJoin: () => void (toggle join/leave; confirmed here if leaving)
 * - onOpenFullList?: () => void (opens shared dialog in parent)
 * - maxVisible?: number
 * - title?: string
 */
export default function MembersStrip({
  members = [],
  totalCount = 0,
  isMember = false,
  canJoin = true,
  joinDisabled = false,
  onJoin,
  onOpenFullList,
  maxVisible = 12,
  title = "Members",
}) {
  const [localOpen, setLocalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const handleOpenList = () => {
    if (onOpenFullList) onOpenFullList();
    else setLocalOpen(true);
  };

  const handleClickJoinLeave = (e) => {
    // Prevent triggering the avatar-row’s onClick (dialog open)
    e?.stopPropagation?.();
    if (isMember) {
      const confirmed = window.confirm("Are you sure you want to leave this club?");
      if (!confirmed) return;
    }
    onJoin?.();
  };

  const visible = members.slice(0, maxVisible);
  const overflow = Math.max(totalCount - visible.length, 0);

  return (
    <section aria-labelledby="members-strip-title" className="w-full">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/60 px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-yellow-400" aria-hidden />
          <div>
            <h2 id="members-strip-title" className="text-sm font-semibold tracking-wide text-neutral-100">
              {title}
            </h2>
            <p className="text-xs text-neutral-400">{totalCount} members</p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
          {/* Avatar row triggers full list */}
          <button
            type="button"
            className="group flex items-center -space-x-2 rounded-full"
            aria-label="View all members"
            title="View all members"
            onClick={handleOpenList}
          >
            {visible.map((m) => (
              <div key={m.id} className="relative">
                <img
                  src={m.avatarUrl}
                  alt={m.name ? `${m.name}'s avatar` : "Member avatar"}
                  className="h-8 w-8 rounded-full ring-2 ring-neutral-900 transition group-hover:translate-y-[-1px]"
                  loading="lazy"
                />
                {/* Swatch badges: gold = president, silver = vice */}
                {m.role === "president" && (
                  <span
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-yellow-500 border border-black"
                    title="President"
                  />
                )}
                {m.role === "vice_president" && (
                  <span
                    className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-gray-400 border border-black"
                    title="Vice President"
                  />
                )}
              </div>
            ))}
            {overflow > 0 && (
              <span className="h-8 w-8 rounded-full bg-neutral-800 ring-2 ring-neutral-900 text-xs grid place-content-center text-neutral-300">
                +{overflow}
              </span>
            )}
          </button>

          {canJoin && (
            <button
              type="button"
              onClick={handleClickJoinLeave}
              aria-label={isMember ? "Leave club" : "Join club"}
              disabled={joinDisabled}
              title={joinDisabled ? "Please wait…" : isMember ? "Leave club" : "Join club"}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed ${
                isMember
                  ? "bg-red-600 text-white hover:bg-red-500"
                  : "bg-yellow-400 text-black hover:bg-yellow-300"
              }`}
            >
              {isMember ? "Leave Club" : "Join Club"}
            </button>
          )}
        </div>
      </div>

      {/* Fallback local dialog if parent didn't provide onOpenFullList */}
      {localOpen && !onOpenFullList && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl max-w-3xl w-full p-6 relative">
            <button
              type="button"
              className="absolute top-3 right-3 text-neutral-400 hover:text-white"
              onClick={() => setLocalOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold mb-4 text-white">
              {title} • {totalCount}
            </h2>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members…"
              className="w-full rounded-xl bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none ring-1 ring-neutral-800 focus:ring-yellow-500 mb-4"
              aria-label="Search members"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {members
                .filter((m) => !search || (m.name || "").toLowerCase().includes(search.toLowerCase()))
                .map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-xl bg-neutral-900/60 p-2 ring-1 ring-neutral-800"
                  >
                    <img src={m.avatarUrl} alt={m.name} className="h-10 w-10 rounded-full" />
                    <p className="truncate text-sm text-neutral-100 flex items-center gap-2">
                      {m.name}
                      {m.role === "president" && (
                        <span
                          className="w-3 h-3 rounded-full bg-yellow-500 inline-block"
                          title="President"
                        />
                      )}
                      {m.role === "vice_president" && (
                        <span
                          className="w-3 h-3 rounded-full bg-gray-400 inline-block"
                          title="Vice President"
                        />
                      )}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}



