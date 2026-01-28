// src/components/MessageItem.jsx
import { useMemo, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Trash2, Flag } from "lucide-react";
import PollCard from "./polls/PollCard";
import RoleBadge from "./RoleBadge.jsx";
import { getUserAvatar, DEFAULT_USER_AVATAR } from "../lib/avatars";

// ID helpers
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INT_RX = /^\d+$/;
const isReportableId = (x) => UUID_RX.test(String(x)) || INT_RX.test(String(x));

function safeJson(s) {
  try { return JSON.parse(s); } catch { return null; }
}

// Try to locate a real, reportable id for this message
function getReportableId(msg) {
  const meta = typeof msg?.metadata === "string"
    ? safeJson(msg.metadata)
    : msg?.metadata || {};
  const candidates = [
    msg?.id,
    msg?.message_id,
    msg?.uuid,
    meta?.message_id,
    meta?.id,
  ].filter((v) => v !== undefined && v !== null);
  for (const c of candidates) {
    if (isReportableId(c)) return String(c);
  }
  return null;
}

// A message is considered "temp" if it has a temp_* id, isn't a UUID/INT, or was flagged as optimistic
function isTempMessage(msg) {
  const id = String(msg?.id || "");
  return id.startsWith("temp_") || (!isReportableId(id) && msg?._optimistic === true);
}

export default function MessageItem({
  msg,
  isMe,
  isAdmin = false,
  onDelete,        // expects onDelete(msg)
  onReport,        // expects onReport(reasonString)  e.g. "abuse"
  onHardDelete,    // expects onHardDelete(msg)
  reportDisabled: reportDisabledProp = false, // optional external override
}) {
  const navigate = useNavigate();
  const p = msg?.profiles || {};
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const btnRef = useRef(null);

  // Derived flags/ids
  const reportableId = getReportableId(msg);         // for info; not used by handler anymore
  const isPersisted = !!reportableId && !isTempMessage(msg);
  const clubId = msg?.club_id ?? msg?.clubId ?? null;

  // Disable report when message is still sending or caller asked to
  const reportDisabled = reportDisabledProp || !isPersisted;

  // time label
  const timeLabel = useMemo(() => {
    if (!msg?.created_at) return "";
    try {
      return new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  }, [msg?.created_at]);

  const goToProfile = () => {
    if (p?.slug) navigate(`/u/${p.slug}`);
    else if (msg?.user_id) navigate(`/profile/${msg.user_id}`);
  };

  // metadata normalize
  const metadata = useMemo(() => {
    if (!msg?.metadata || msg?.metadata === "null") return null;
    if (typeof msg.metadata === "object") return msg.metadata;
    try { return JSON.parse(msg.metadata); } catch { return null; }
  }, [msg?.metadata]);

  const pollId = metadata?.poll_id || null;
  const isPoll = msg?.type === "poll" || Boolean(pollId);

  // close menu on outside click / ESC
  useEffect(() => {
    const onDocClick = (e) => {
      if (!open) return;
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        !btnRef.current?.contains(e.target)
      ) setOpen(false);
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
  const canHardDelete = isAdmin && typeof onHardDelete === "function" && !!msg?.is_deleted;

  const avatarSrc = getUserAvatar(p);
  const displayName = p?.display_name || "Member";

  // bubble styles (reserve space for kebab)
  const bubbleBase =
    "relative inline-block max-w-[80%] rounded-2xl overflow-visible " +
    (isPoll ? "px-0 py-0 pr-12" : "px-4 py-2 pr-12");
  const bubbleColor = isPoll
    ? "bg-transparent"
    : isMe
    ? "bg-yellow-400 text-black"
    : "bg-zinc-800 text-zinc-100";

  return (
    <div
      className={`group flex items-start gap-3 my-2 ${isMe ? "justify-end" : ""}`}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      data-message-id={msg?.id}
    >
      {!isMe && (
        <button onClick={goToProfile} className="shrink-0" aria-label="Open profile">
          <img
            src={avatarSrc}
            alt={displayName || "User avatar"}
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_USER_AVATAR; }}
            className="h-8 w-8 rounded-full object-cover hover:opacity-90 border border-zinc-700"
          />
        </button>
      )}

      <div className={`${bubbleBase} ${bubbleColor}`}>
        {/* Actions */}
        {(canReport || canDelete || canHardDelete) && (
          <div className="absolute top-1.5 right-1.5">
            <button
              ref={btnRef}
              onClick={() => setOpen((v) => !v)}
              className="h-8 w-8 rounded-full flex items-center justify-center
                         bg-black/25 hover:bg-black/35
                         focus:outline-none focus:ring-2 focus:ring-yellow-500
                         transition"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="Message actions"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>

            {open && (
              <div
                ref={menuRef}
                role="menu"
                className="absolute right-0 mt-2 w-56 z-[1200]
                           rounded-xl border border-zinc-700
                           bg-zinc-900/95 shadow-2xl backdrop-blur-sm
                           text-zinc-100 p-1"
              >
                {canReport && (
                  <button
                    role="menuitem"
                    disabled={reportDisabled}
                    title={reportDisabled ? "Message is still sending…" : "Report"}
                    onClick={() => {
                      if (reportDisabled) return;
                      setOpen(false);
                      // Call with a reason string; ClubChat maps it to your handler
                      onReport?.("abuse");
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm rounded-lg flex items-center gap-2
                      ${reportDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-zinc-800"}`}
                  >
                    <Flag className="h-4 w-4" />
                    <span>Report</span>
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
                      if (window.confirm("Delete this message for everyone?")) onDelete?.(msg);
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-zinc-800 rounded-lg flex items-center gap-2 text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete</span>
                  </button>
                )}

                {canHardDelete && (
                  <>
                    {canDelete && <div className="my-1 h-px bg-zinc-800" />}
                    <button
                      role="menuitem"
                      onClick={() => {
                        setOpen(false);
                        if (window.confirm("Permanently delete this message? This cannot be undone.")) {
                          onHardDelete?.(msg);
                        }
                      }}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-zinc-800 rounded-lg flex items-center gap-2 text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Permanently delete</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Optional: subtle “sending…” indicator for your own optimistic messages */}
        {isMe && !msg?.is_deleted && isTempMessage(msg) && (
          <div className="absolute top-2 right-3 text-[10px] text-black/60 dark:text-zinc-400">
            sending…
          </div>
        )}

        {!msg?.is_deleted && (
          <>
            {isPoll ? (
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

            {/* footer */}
            <div
              className={`flex items-center gap-1 text-[10px] opacity-60 mt-1 ${
                isMe ? "text-black" : "text-zinc-300"
              }`}
            >
              <span onClick={goToProfile} className="cursor-pointer hover:underline">
                {p?.display_name || "Member"}
              </span>
              <RoleBadge role={msg?.role} />
              <span>• {timeLabel}</span>
              {/* Optional tiny hint showing persistence state for debugging */}
              {/* {!isPersisted && <span className="ml-1">• sending</span>} */}
            </div>
          </>
        )}
      </div>

      {isMe && (
        <button onClick={goToProfile} className="shrink-0" aria-label="Open profile">
          <img
            src={avatarSrc}
            alt="My avatar"
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_USER_AVATAR; }}
            className="h-8 w-8 rounded-full object-cover hover:opacity-90 border border-zinc-700"
          />
        </button>
      )}
    </div>
  );
}
