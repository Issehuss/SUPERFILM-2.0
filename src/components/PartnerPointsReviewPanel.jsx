import React, { useEffect, useState, useMemo } from "react";
import { useUser } from "../context/UserContext";
import supabase from "../supabaseClient";

// Safe lowercasing that tolerates null/undefined/non-strings
const toKey = (v) => (v == null ? "" : String(v)).trim().toLowerCase();

/**
 * PartnerPointsReviewPanel
 * SuperFilm staff / PARTNER accounts only.
 * - shows PENDING point_events for a club
 * - partners can approve / reject
 * - emits "points-updated" on window so other cards can refresh
 */
export default function PartnerPointsReviewPanel({ clubId, onChange }) {
  const { isPartner } = useUser();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!isPartner || !clubId) {
        if (alive) {
          setRows([]);
          setErr("");
          setLoading(false);
        }
        return;
      }

      if (alive) {
        setLoading(true);
        setErr("");
      }

      const { data, error } = await supabase
        .from("point_events")
        .select("*")
        .eq("club_id", clubId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(25);

      if (!alive) return;

      if (error) {
        setErr(error.message || "Could not load point events.");
        setRows([]);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    }

    load();

    // ✅ Correct Realtime usage
    const ch =
      isPartner && clubId
        ? supabase
            .channel(`points-review:${clubId}`)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "point_events",
                filter: `club_id=eq.${clubId}`,
              },
              () => {
                load();
              }
            )
            .subscribe()
        : null;

    return () => {
      alive = false;
      if (ch) supabase.removeChannel(ch);
    };
  }, [clubId, isPartner]);

  if (!isPartner) return null;

  return (
    <div className="rounded-2xl border border-yellow-500/20 bg-black/40 p-4 mt-6">
      <h3 className="text-sm font-semibold text-yellow-300">
        Partner / Safety: Points to review
      </h3>

      {loading ? (
        <div className="mt-3 h-10 w-full animate-pulse rounded bg-zinc-900" />
      ) : err ? (
        <div className="mt-3 text-sm text-red-400">{err}</div>
      ) : rows.length === 0 ? (
        <div className="mt-3 text-sm text-zinc-400">
          Nothing to review right now.
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((r) => (
            <PartnerPointItem
              key={r.id}
              row={r}
              clubId={clubId}
              onChange={onChange}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PartnerPointItem({ row, clubId, onChange }) {
  const evidenceUrl = useMemo(
    () =>
      row.evidence_url ||
      row.proof_url ||
      row.attachment_url ||
      row.media_url ||
      row.evidence ||
      null,
    [row]
  );

  async function approve() {
    const { error } = await supabase
      .from("point_events")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error) {
      alert(error.message);
      return;
    }

    onChange?.();
    window.dispatchEvent(
      new CustomEvent("points-updated", { detail: { clubId } })
    );
  }

  async function reject() {
    const { error } = await supabase
      .from("point_events")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error) {
      alert(error.message);
      return;
    }

    onChange?.();
    window.dispatchEvent(
      new CustomEvent("points-updated", { detail: { clubId } })
    );
  }

  return (
    <li className="rounded-xl border border-zinc-800 bg-black/30 p-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white">
            {row.reason || "Point event"} •{" "}
            <span className="text-zinc-400">{row.points ?? 0} pts</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            submitted{" "}
            {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
          </div>
          {evidenceUrl ? (
            <a
              href={evidenceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-yellow-400 underline mt-2 inline-block break-all"
            >
              View evidence
            </a>
          ) : (
            <div className="text-[11px] text-zinc-500 mt-2">No attachment</div>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={approve}
            className="rounded bg-green-500/90 px-2 py-1 text-xs font-semibold text-black hover:bg-green-400"
          >
            Approve
          </button>
          <button
            onClick={reject}
            className="rounded bg-red-500/90 px-2 py-1 text-xs font-semibold text-black hover:bg-red-400"
          >
            Reject
          </button>
        </div>
      </div>
    </li>
  );
}
