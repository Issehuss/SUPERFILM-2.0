import React, { useEffect, useState } from "react";
import { useUser } from "../context/UserContext";
import supabase from "../supabaseClient";
import useRealtimeResume from "../hooks/useRealtimeResume";

// Safe lowercasing that tolerates null/undefined/non-strings
const toKey = (v) => (v == null ? "" : String(v)).trim().toLowerCase();

export default function PartnerChatAuditPanel({ clubId, limit = 20 }) {
  const { isPartner } = useUser();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const resumeTick = useRealtimeResume();

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!clubId || !isPartner) {
        if (alive) {
          setRows([]);
          setLoading(false);
          setErr("");
        }
        return;
      }

      if (alive) {
        setLoading(true);
        setErr("");
      }

      const { data, error } = await supabase
        .from("club_messages_audit_v")
        .select(
          "id, club_id, created_at, type, body, content, image_url, is_deleted, author_name, author_slug"
        )
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!alive) return;

      if (error) {
        setErr(error.message || "Could not load messages.");
        setRows([]);
      } else {
        setRows(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    }

    load();

    // ✅ Correct Realtime usage
    const channel =
      clubId && isPartner
        ? supabase
            .channel(`partner-chat:${clubId}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "club_messages",
                filter: `club_id=eq.${clubId}`,
              },
              () => {
                // Reload on any change for this club
                load();
              }
            )
            .subscribe()
        : null;

    return () => {
      alive = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [clubId, isPartner, limit, resumeTick]);

  if (!isPartner || !clubId) return null;

  return (
    <div className="mt-4 rounded-2xl border border-red-500/25 bg-black/35 p-4">
      <h3 className="text-sm font-semibold text-red-200">
        Partner / Safety: Latest club chat
      </h3>

      {loading ? (
        <div className="mt-3 space-y-2">
          <div className="h-8 bg-zinc-900/70 rounded animate-pulse" />
          <div className="h-8 bg-zinc-900/70 rounded animate-pulse" />
        </div>
      ) : err ? (
        <div className="mt-3 text-xs text-red-400">
          Can’t load chat audit: {err}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-3 text-xs text-zinc-400">
          No messages in this club yet.
        </div>
      ) : (
        <ul className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
          {rows.map((m) => {
            const isDeleted = m.is_deleted === true;
            return (
              <li
                key={m.id}
                className={
                  "rounded-lg border p-2 " +
                  (isDeleted
                    ? "bg-red-950/20 border-red-900/40"
                    : "bg-zinc-950/40 border-zinc-800/40")
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-zinc-200 flex items-center gap-1">
                    <span>{m.author_name || m.author_slug || "Member"}</span>
                    {toKey(m.type) ? (
                      <span className="text-[9px] uppercase tracking-wide bg-white/5 px-1.5 py-0.5 rounded-full text-zinc-300">
                        {toKey(m.type)}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[10px] text-zinc-500">
                    {m.created_at
                      ? new Date(m.created_at).toLocaleString()
                      : ""}
                  </span>
                </div>

                <p
                  className={
                    "text-sm mt-1 break-words " +
                    (isDeleted ? "line-through text-zinc-500" : "text-white")
                  }
                >
                  {m.content || m.body || (isDeleted ? "[deleted]" : "")}
                </p>

                {m.image_url ? (
                  <a
                    href={m.image_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-[10px] text-yellow-300 underline"
                  >
                    View image
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
