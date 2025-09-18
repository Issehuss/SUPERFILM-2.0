// src/components/MessageItem.jsx
import { useMemo, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Trash2, Flag } from "lucide-react";
import PollCard from "./polls/PollCard";
import RoleBadge from "./RoleBadge.jsx";

export default function MessageItem({
  msg,
  isMe,
  isAdmin = false,
  onDelete,
  onReport,      // expects onReport({ messageId, clubId })
  onHardDelete,  // expects onHardDelete(msg)
}) {
  const navigate = useNavigate();
  const p = msg?.profiles || {};
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const btnRef = useRef(null);

  // ---- helpers ----
  const timeLabel = useMemo(() => {
    if (!msg?.created_at) return "";
    try {
      return new Date(msg.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [msg?.created_at]);

  const goToProfile = () => {
    if (p?.slug) navigate(`/u/${p.slug}`);
    else if (msg?.user_id) navigate(`/profile/${msg.user_id}`);
  };

  // Normalize metadata (string | object | null | "null")
  const metadata = useMemo(() => {
    const m = msg?.metadata;
    if (!m || m === "null") return null;
    if (typeof m === "object") return m;
    try {
      return JSON.parse(m);
    } catch {
      return null;
    }
  }, [msg?.metadata]);

  const pollId = metadata?.poll_id || null;
  const isPoll = msg?.type === "poll" || Boolean(pollId);

  // Close popover on outside click / ESC
  useEffect(() => {
    const onDocClick = (e) => {
      if (!open) return;
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        !btnRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const canReport = typeof onReport === "function";
  const canDelete = (isMe || isAdmin) && typeof onDelete === "function";
  const canHardDelete =
    isAdmin && typeof onHardDelete === "function" && !!msg?.is_deleted;

  const avatarSrc = p?.avatar_url || "/avatar-fallback.png";
  const displayName = p?.display_name || "Unknown";
  const clubId = msg?.club_id ?? msg?.clubId ?? null;

  const bubbleBase =
    "relative rounded-2xl max-w-[72%] overflow-visible " +
    (isPoll ? "px-0 py-0" : "px-3 py-2");
  const bubbleColor = isPoll
    ? "bg-transparent"
    : isMe
    ? "bg-yellow-400 text-black"
    : "bg-zinc-800 text-zinc-100";

  return (
    <div
      className={`group flex items-start gap-3 ${isMe ? "justify-end" : ""}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      data-message-id={msg?.id}
    >
      {!isMe && (
        <button onClick={goToProfile} className="shrink-0" aria-label="Open profile">
          <img
            src={avatarSrc}
            alt={displayName || "User avatar"}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/avatar-fallback.png";
            }}
            className="h-8 w-8 rounded-full object-cover hover:opacity-90 border border-zinc-700"
          />
        </button>
      )}

      <div className={`${bubbleBase} ${bubbleColor}`}>
        {/* Kebab menu */}
        {(canReport || canDelete || canHardDelete) && (
          <div className="absolute top-1.5 right-1.5">
            <button
              ref={btnRef}
              onClick={() => setOpen((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-yellow-400/60 opacity-90 hover:opacity-100"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="Message actions"
            >
              <MoreHorizontal size={18} />
            </button>

            {open && (
              <div
                ref={menuRef}
                role="menu"
                className="absolute right-0 mt-2 min-w-56 rounded-2xl bg-zinc-950/98 border border-zinc-800 shadow-2xl ring-1 ring-yellow-500/15 z-[1200] p-1"
              >
                {canReport && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      onReport?.({ messageId: msg?.id, clubId });
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-zinc-800/60 rounded-xl text-yellow-300 flex items-center gap-2"
                  >
                    <Flag size={16} />
                    Report
                  </button>
                )}

                {(canReport && (canDelete || canHardDelete)) && (
                  <div className="my-1 h-px bg-zinc-800" />
                )}

                {canDelete && !msg?.is_deleted && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      if (window.confirm("Delete this message for everyone?")) {
                        onDelete?.(msg);
                      }
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-zinc-800/60 rounded-xl text-red-400 flex items-center gap-2"
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                )}

                {canHardDelete && (
                  <>
                    {canDelete && <div className="my-1 h-px bg-zinc-800" />}
                    <button
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        if (
                          window.confirm(
                            "Permanently delete this message? This cannot be undone."
                          )
                        ) {
                          onHardDelete?.(msg);
                        }
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-zinc-800/60 rounded-xl text-red-500 flex items-center gap-2"
                    >
                      <Trash2 size={16} />
                      Permanently delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Content section */}
        {!msg?.is_deleted && (
          <>
            {isPoll ? (
              // Single poll design (bottom-right card style) via PollCard
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
                <PollCard pollId={pollId} />
              </div>
            ) : (
              <>
                {!!msg?.body && (
                  <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                )}
                {!!msg?.image_url && (
                  <a href={msg.image_url} target="_blank" rel="noreferrer">
                    <img
                      src={msg.image_url}
                      alt="attachment"
                      className="rounded-xl mt-2 max-h-72 object-contain border border-zinc-700"
                    />
                  </a>
                )}
              </>
            )}

            {/* footer: name + role + time */}
            <div
              className={`flex items-center gap-1 text-[10px] opacity-60 mt-1 ${
                isMe ? "text-black" : "text-zinc-300"
              }`}
            >
              <span
                onClick={goToProfile}
                className="cursor-pointer hover:underline"
              >
                {displayName}
              </span>
              <RoleBadge role={msg?.role} />
              <span>• {timeLabel}</span>
            </div>
          </>
        )}
      </div>

      {isMe && (
        <button onClick={goToProfile} className="shrink-0" aria-label="Open profile">
          <img
            src={avatarSrc}
            alt="My avatar"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/avatar-fallback.png";
            }}
            className="h-8 w-8 rounded-full object-cover hover:opacity-90 border border-zinc-700"
          />
        </button>
      )}
    </div>
  );
}
