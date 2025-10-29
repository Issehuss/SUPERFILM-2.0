import { useEffect, useState, useMemo } from "react";
import supabase from "../supabaseClient";

/**
 * PointsReviewPanel
 * - Does not assume an `evidence_url` column.
 * - Selects "*" and gracefully uses any of: evidence_url, proof_url, attachment_url, media_url.
 */
export default function PointsReviewPanel({ clubId, onChange }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!clubId) return;
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");

      // Be permissive: select all columns so we don't break on missing ones.
      const { data, error } = await supabase
        .from("point_events")
        .select("*")
        .eq("club_id", clubId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(25);

      if (!alive) return;

      if (error) {
        setErr(error.message);
        setRows([]);
      } else {
        setRows(data || []);
      }
      setLoading(false);
    }

    load();

    const ch = supabase
      .channel(`points-review:${clubId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "point_events", filter: `club_id=eq.${clubId}` },
        load
      )
      .subscribe();

    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [clubId]);

  async function approve(id) {
    const { error } = await supabase.from("point_events").update({ status: "approved" }).eq("id", id);
    if (error) return alert(error.message);
    onChange?.();
    // notify any listening cards
    window.dispatchEvent(new CustomEvent("points-updated", { detail: { clubId } }));
  }

  async function reject(id) {
    const { error } = await supabase.from("point_events").update({ status: "rejected" }).eq("id", id);
    if (error) return alert(error.message);
    onChange?.();
    window.dispatchEvent(new CustomEvent("points-updated", { detail: { clubId } }));
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
      <h3 className="text-sm font-semibold text-white">Points Review</h3>

      {loading ? (
        <div className="mt-3 h-10 w-full animate-pulse rounded bg-zinc-900" />
      ) : err ? (
        <div className="mt-3 text-sm text-red-400">{err}</div>
      ) : rows.length === 0 ? (
        <div className="mt-3 text-sm text-zinc-400">Nothing to review right now.</div>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((r) => (
            <Item key={r.id} row={r} onApprove={() => approve(r.id)} onReject={() => reject(r.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Item({ row, onApprove, onReject }) {
  // Try multiple possible evidence keys; fall back to null if none.
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

  const created =
    row.created_at ? new Date(row.created_at).toLocaleString() : "";

  return (
    <li className="rounded-xl border border-zinc-800 bg-black/30 p-3">
      <div className="text-sm text-white">
        {row.reason || "Point event"} •{" "}
        <span className="text-zinc-400">{row.points ?? 0} pts</span>
        {row.status && (
          <span className="ml-2 text-[11px] text-zinc-400">[{row.status}]</span>
        )}
      </div>

      {created && (
        <div className="text-[11px] text-zinc-500 mt-1">{created}</div>
      )}

      {evidenceUrl ? (
        <a
          href={evidenceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-yellow-400 underline mt-2 inline-block"
        >
          View evidence
        </a>
      ) : (
        <div className="text-[11px] text-zinc-500 mt-2">No attachment</div>
      )}

      <div className="mt-2 flex gap-2">
        <button
          onClick={onApprove}
          className="rounded bg-green-500/90 px-2 py-1 text-xs font-semibold text-black hover:bg-green-400"
        >
          Approve
        </button>
        <button
          onClick={onReject}
          className="rounded bg-red-500/90 px-2 py-1 text-xs font-semibold text-black hover:bg-red-400"
        >
          Reject
        </button>
      </div>
    </li>
  );
}
