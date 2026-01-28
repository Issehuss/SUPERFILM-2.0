// src/components/RecentPointAwards.jsx
import { useEffect, useMemo, useState } from "react";
import supabase from "lib/supabaseClient";

/**
 * Shows recent approved point events for a club.
 * Enforces "display cap": max 6 counted points per user per calendar week.
 * (Server should still enforce caps; this makes the UI consistent.)
 */
export default function RecentPointAwards({ clubId, limit = 10, className = "" }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Monday as start of week (00:00:00 local)
  function weekStart(d) {
    const dt = new Date(d);
    const day = dt.getDay(); // 0=Sun..6=Sat
    const diff = (day === 0 ? -6 : 1 - day); // move back to Monday
    dt.setDate(dt.getDate() + diff);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  // Add "counted_points" and "overflow_points" per user/week
  const decorated = useMemo(() => {
    if (!rows?.length) return [];

    // We need to iterate **ascending** by created_at to accumulate weekly totals correctly,
    // then sort **descending** for display.
    const asc = [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const weeklyTally = new Map(); // key: `${user_id}|${weekISO}` -> counted so far
    const out = asc.map((r) => {
      const wk = weekStart(r.created_at);
      const key = `${r.user_id}|${wk.toISOString()}`;
      const soFar = weeklyTally.get(key) ?? 0;
      const remaining = Math.max(0, 6 - soFar);
      const counted = Math.max(0, Math.min(remaining, r.points || 0));
      const overflow = Math.max(0, (r.points || 0) - counted);
      weeklyTally.set(key, soFar + counted);
      return { ...r, counted_points: counted, overflow_points: overflow };
    });

    // display newest first, then trim to limit
    return out.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit);
  }, [rows, limit]);

  async function load() {
    if (!clubId) return;
    setLoading(true);

    // Pull enough history to cover this & the previous week (so caps are accurate even if
    // we only display the latest subset).
    const start = weekStart(new Date());
    const twoWeeksAgo = new Date(start);
    twoWeeksAgo.setDate(start.getDate() - 7); // previous week start

    const { data, error } = await supabase
      .from("point_events")
      .select(
        `
        id, user_id, points, reason, created_at, status,
        profiles:user_id (display_name, slug, avatar_url),
        awarded_by_profile:approved_by (display_name)
      `
      )
      .eq("club_id", clubId)
      .eq("status", "approved")
      .gte("created_at", twoWeeksAgo.toISOString()) // capture previous + current week
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[RecentPointAwards] error:", error.message);
      setRows([]);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();

    const onBump = (e) => {
      if (e?.detail?.clubId && e.detail.clubId !== clubId) return;
      load();
    };
    window.addEventListener("points-updated", onBump);
    return () => window.removeEventListener("points-updated", onBump);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  if (loading) {
    return (
      <div className={`rounded-2xl border border-zinc-800 bg-black/40 p-4 ${className}`}>
        <div className="h-6 w-40 animate-pulse rounded bg-zinc-900" />
      </div>
    );
  }

  if (!decorated.length) return null;

  return (
    <div className={`rounded-2xl border border-zinc-800 bg-black/40 p-4 ${className}`}>
      <div className="text-sm font-semibold text-white">Recent point awards</div>
      <ul className="mt-3 space-y-3">
        {decorated.map((r) => (
          <li key={r.id} className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full overflow-hidden bg-zinc-800">
              {r.profiles?.avatar_url && (
                <img src={r.profiles.avatar_url} alt="" className="h-full w-full object-cover" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-white">
                {r.profiles?.display_name || "Member"}
                <span className="text-zinc-400"> · {r.reason || "—"}</span>
              </div>
              <div className="text-[11px] text-zinc-500">
                {new Date(r.created_at).toLocaleString()}
              </div>
            </div>

            <div className="text-right">
              {/* Show how many counted, and indicate overflow if any */}
              <div className="text-sm font-medium text-white">
                {r.counted_points > 0 ? `+${r.counted_points}` : "+0"}
                {r.overflow_points > 0 && (
                  <span
                    title={`${r.overflow_points} did not count (weekly cap reached)`}
                    className="ml-1 text-[11px] text-zinc-400"
                  >
                    (+{r.overflow_points} capped)
                  </span>
                )}
              </div>
              {r.awarded_by_profile?.display_name && (
                <div className="text-[11px] text-zinc-500">
                  by {r.awarded_by_profile.display_name}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Small legend */}
      <div className="mt-3 text-[11px] text-zinc-500">
        Max 6 points per member, per calendar week. Extra awards show as “capped” and do not count.
      </div>
    </div>
  );
}
