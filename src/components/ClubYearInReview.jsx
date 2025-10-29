import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabaseClient";

export default function ClubYearInReview({ clubId, year = new Date().getFullYear(), className = "" }) {
  const [totals, setTotals] = useState(null);
  const [tops, setTops] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      const [{ data: t, error: e1 }, { data: l, error: e2 }] = await Promise.all([
        supabase.rpc("club_yir_totals", { p_club: clubId, p_year: year }),
        supabase.rpc("club_yir_top_lists", { p_club: clubId, p_year: year }),
      ]);
      if (cancelled) return;
      if (e1) console.error(e1);
      if (e2) console.error(e2);
      setTotals((t && t[0]) || null);
      setTops(l || []);
      setLoading(false);
    }
    if (clubId) run();
    return () => (cancelled = true);
  }, [clubId, year]);

  return (
    <div className={`w-full rounded-2xl border border-zinc-800 bg-black/40 p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Year in Review (so far)</h3>
        <div className="text-sm text-zinc-400">{year}</div>
      </div>

      {loading && <div className="text-sm text-zinc-400">Loading…</div>}

      {!loading && totals && (
        <>
          {/* Hero cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Events" value={totals.events_created} />
            <StatCard label="Total Attendees" value={totals.total_attendees} />
            <StatCard label="Avg Attendance" value={fmtNum(totals.avg_attendance)} />
            <StatCard label="Avg Rating" value={fmtNum(totals.avg_rating)} />
          </div>

          {/* Highlights */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <Highlight
              title="Highest-Rated Screening"
              primary={totals.highest_rated_title || "—"}
              meta={
                totals.highest_rated_avg
                  ? `${fmtNum(totals.highest_rated_avg)}★ • ${totals.highest_rated_count} ratings`
                  : "No ratings yet"
              }
              onClick={
                totals.highest_rated_screening_id
                  ? () => navigate(`screenings/${totals.highest_rated_screening_id}`)
                  : undefined
              }
            />
            <Highlight
              title="Best-Attended Screening"
              primary={totals.best_attended_title || "—"}
              meta={
                totals.best_attended_count ? `${totals.best_attended_count} attendees` : "No attendance yet"
              }
              onClick={
                totals.best_attended_screening_id
                  ? () => navigate(`screenings/${totals.best_attended_screening_id}`)
                  : undefined
              }
            />
          </div>

          {/* Top lists */}
          {tops.length > 0 && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <TopList title="Top Rated (avg★, min 5 ratings)" items={tops.filter(t => t.kind === "highest_rated")} />
              <TopList title="Most Attended" items={tops.filter(t => t.kind === "most_attended")} />
            </div>
          )}
        </>
      )}

      {!loading && !totals && <div className="text-sm text-zinc-400">No data yet.</div>}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black/30 p-3">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value ?? "—"}</div>
    </div>
  );
}

function Highlight({ title, primary, meta, onClick }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`text-left rounded-xl border border-zinc-800 bg-black/30 p-3 ${onClick ? "hover:bg-black/40 transition" : ""}`}
    >
      <div className="text-xs text-zinc-400">{title}</div>
      <div className="mt-1 text-lg font-medium text-white line-clamp-1">{primary}</div>
      <div className="text-sm text-zinc-400">{meta}</div>
    </Comp>
  );
}

function TopList({ title, items }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black/30 p-3">
      <div className="text-xs text-zinc-400 mb-2">{title}</div>
      {items.length === 0 ? (
        <div className="text-sm text-zinc-500">No data yet.</div>
      ) : (
        <ol className="space-y-2">
          {items.map((it, idx) => (
            <li key={it.screening_id} className="flex items-center justify-between gap-2">
              <span className="text-zinc-300">
                <span className="text-zinc-500 mr-2">{idx + 1}.</span>
                {it.title}
              </span>
              <span className="text-zinc-400 text-sm">
                {it.kind === "highest_rated" ? `${fmtNum(it.metric)}★ (${it.extra})` : `${it.metric} attendees`}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function fmtNum(n) {
  if (n === null || n === undefined) return "—";
  const num = Number(n);
  if (Number.isNaN(num)) return "—";
  return num.toFixed(2).replace(/\.00$/, "");
}
