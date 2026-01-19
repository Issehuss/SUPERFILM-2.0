// src/pages/LeaderboardAndPlayoffs.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";
import { Info } from "lucide-react";
import useRealtimeResume from "../hooks/useRealtimeResume";

export default function LeaderboardAndPlayoffs() {
  const navigate = useNavigate();
  const { user, profile } = useUser();
  const resumeTick = useRealtimeResume();

  const [tab, setTab] = useState("leaderboard"); // 'leaderboard' | 'playoffs'
  const [showInfo, setShowInfo] = useState(false);

  /* ---------------- PLAYOFFS (kept) ---------------- */
  const [clubName, setClubName] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState(null);
  const [seasonLoading, setSeasonLoading] = useState(true);

  const primaryClubId = useMemo(() => {
    const arr = Array.isArray(profile?.joined_clubs) ? profile.joined_clubs : [];
    return arr.length ? arr[0] : null;
  }, [profile?.joined_clubs]);

  useEffect(() => {
    if (tab !== "playoffs") return;
    let alive = true;
    (async () => {
      setSeasonLoading(true);
      const [{ data: sList }, { data: curId }] = await Promise.all([
        supabase.from("seasons").select("id, name, starts_at, ends_at").order("starts_at", { ascending: false }),
        supabase.rpc("get_current_season"),
      ]);
      if (!alive) return;
      setSeasons(sList || []);
      setSeasonId(curId || sList?.[0]?.id || null);
      setSeasonLoading(false);
    })();
    return () => { alive = false; };
  }, [tab, resumeTick]);

  useEffect(() => {
    if (tab !== "playoffs") return;
    let isMounted = true;

    async function load() {
      if (!primaryClubId) { setLoading(false); return; }
      const { data: clubRow } = await supabase
        .from("clubs_public")
        .select("name")
        .eq("id", primaryClubId)
        .maybeSingle();
      if (isMounted) setClubName(clubRow?.name || "");
      if (!seasonId) { setRows([]); setLoading(false); return; }

      const { data: pts, error } = await supabase.rpc(
        "get_season_leaderboard_with_profiles",
        { p_club: primaryClubId, p_season: seasonId, p_limit: 200 }
      );
      if (error) {
        console.error("[Playoffs] season leaderboard error:", error);
        if (isMounted) { setRows([]); setLoading(false); }
        return;
      }
      if (isMounted) { setRows(pts || []); setLoading(false); }
    }

    setLoading(true);
    load();
    return () => { isMounted = false; };
  }, [tab, primaryClubId, seasonId, reloadTick]);

  useEffect(() => {
    if (tab !== "playoffs") return;
    function onBump(e) {
      if (!primaryClubId) return;
      if (e?.detail?.clubId && e.detail.clubId !== primaryClubId) return;
      setReloadTick((t) => t + 1);
    }
    window.addEventListener("points-updated", onBump);
    return () => window.removeEventListener("points-updated", onBump);
  }, [tab, primaryClubId]);

  const youId = user?.id;
  const seeds = (rows || []).slice(0, 8);

  /* --------------- LEADERBOARD (clubs + stats) --------------- */
  const [clubs, setClubs] = useState([]);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [weekMap, setWeekMap] = useState({});  // club_id -> weekly score (0..6)
  const [totalMap, setTotalMap] = useState({}); // club_id -> season-to-date club score (for now: sync to weekly)

  useEffect(() => {
    if (tab !== "leaderboard") return;
    let cancelled = false;

    const loadClubsAndStats = async () => {
      setClubsLoading(true);

      // 1) clubs
      const { data: clubRows, error: cErr } = await supabase
        .from("clubs_public")
        .select("id, slug, name, banner_url, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;

      if (cErr) {
        console.warn("[Leaderboard tab] clubs fetch error:", cErr.message);
        setClubs([]);
        setWeekMap({});
        setTotalMap({});
        setClubsLoading(false);
        return;
      }

      const clubsData = clubRows || [];
      setClubs(clubsData);

      if (clubsData.length === 0) {
        setWeekMap({});
        setTotalMap({});
        setClubsLoading(false);
        return;
      }

      const ids = clubsData.map((c) => c.id);

      // 2) stats — fair weekly club score (0..6) via RPC
      const { data: weekRows, error: wsErr } = await supabase
        .rpc("get_club_week_scores", { p_clubs: ids });

      if (cancelled) return;
      if (wsErr) console.warn("[Leaderboard tab] week score RPC error:", wsErr.message);

      const wMap = {};
      (weekRows || []).forEach((r) => {
        wMap[r.club_id] = Number(r.weekly_club_score || 0);   // 0..6
      });

      setWeekMap(wMap);

      // 3) TOTALS: for now, sync to weekly (Week 1: 6 → Total 6)
      // TODO: replace with season cumulative RPC that sums weekly_club_score by week since season start.
      setTotalMap(wMap);

      setClubsLoading(false);
    };

    loadClubsAndStats();

    // realtime refresh on either clubs or point_events
    const chClubs = supabase
      .channel("clubs-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "clubs" }, loadClubsAndStats)
      .subscribe();

    const chPoints = supabase
      .channel("points-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "point_events" }, loadClubsAndStats)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(chClubs);
      supabase.removeChannel(chPoints);
    };
  }, [tab]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-sm text-zinc-400 hover:text-zinc-200"
      >
        ← Back
      </button>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-white">Leaderboard & Playoffs</h1>

        {/* Info button */}
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          className="ml-1 inline-flex items-center justify-center rounded-md border border-yellow-400/50 bg-yellow-400/15 p-2 text-yellow-200 hover:text-yellow-50 hover:border-yellow-300"
          title="How points & playoffs work"
        >
          <Info size={16} />
        </button>

        {/* Toggle */}
        <div className="ml-auto inline-flex rounded-lg border border-zinc-800 bg-black/40 p-1">
          <button
            className={`px-3 py-1.5 text-sm rounded-md ${tab === "leaderboard" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
            onClick={() => setTab("leaderboard")}
          >
            Leaderboard
          </button>
          <button
            className={`px-3 py-1.5 text-sm rounded-md ${tab === "playoffs" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
            onClick={() => setTab("playoffs")}
          >
            Playoffs
          </button>
        </div>
      </div>

      {tab === "leaderboard" ? (
        <LeaderboardBlankTable
          loading={clubsLoading}
          clubs={clubs}
          weekMap={weekMap}
          totalMap={totalMap}
        />
      ) : (
        <PlayoffsBlock
          loading={loading}
          clubName={clubName}
          seasons={seasons}
          seasonId={seasonId}
          setSeasonId={setSeasonId}
          seasonLoading={seasonLoading}
          rows={rows}
          youId={youId}
          seeds={seeds}
        />
      )}

      {/* Info modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">How the leaderboard works</h3>
              <button
                onClick={() => setShowInfo(false)}
                className="rounded-md border border-zinc-800 px-2 py-1 text-zinc-300 hover:text-white hover:border-zinc-700"
              >
                Close
              </button>
            </div>
            <div className="mt-3 space-y-2 leading-relaxed">
              <p>
                Points are just for fun. We’re looking at which clubs feel alive, don’t take them too seriously.
              </p>
              <p>
                In late August we’ll randomly select 8 clubs for playoffs. It’s not based on points; the only requirement
                is that your club shows signs of life.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------
   Leaderboard: blank table
--------------------------- */
function LeaderboardBlankTable({ loading, clubs, weekMap, totalMap }) {
  return (
    <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/40 p-4">
      <div className="text-sm font-semibold text-white">Clubs</div>

      {/* tiny hint */}
      <div className="mt-2 rounded-md border border-zinc-800 bg-black/30 p-2 text-xs text-zinc-400">
        Points are <span className="text-white">average per member</span>, max <span className="text-white">6</span> each week.
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-400">
              <th className="text-left font-normal py-2 pr-3">Club</th>
              <th className="text-left font-normal py-2 pr-3">Points</th>
              <th className="text-left font-normal py-2 pr-3">Total</th>
              <th className="text-right font-normal py-2">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td className="py-3">
                    <div className="h-5 w-48 rounded bg-zinc-900 animate-pulse" />
                  </td>
                  <td className="py-3">
                    <div className="h-5 w-24 rounded bg-zinc-900 animate-pulse" />
                  </td>
                  <td className="py-3">
                    <div className="h-5 w-20 rounded bg-zinc-900 animate-pulse" />
                  </td>
                  <td className="py-3 text-right">
                    <div className="h-5 w-16 rounded bg-zinc-900 animate-pulse ml-auto" />
                  </td>
                </tr>
              ))
            ) : clubs.length === 0 ? (
              <tr>
                <td className="py-4 text-zinc-400" colSpan={4}>No clubs yet.</td>
              </tr>
            ) : (
              clubs.map((c) => {
                const w = Number(weekMap[c.id] || 0); // 0..6
                const t = Number(totalMap[c.id] || 0); // synced to weekly for now
                const pct = Math.max(4, Math.round((w / 6) * 100)); // progress vs 6, keep a tiny min width
                
                return (
                  <tr key={c.id} className="hover:bg-white/5">
                    <td className="py-3 pr-3">
                      <a
                        href={c.slug ? `/clubs/${c.slug}` : `/clubs/${c.id}`}
                        className="flex items-center gap-3 group"
                        title="Open club profile"
                      >
                        <div className="h-7 w-7 rounded-full overflow-hidden bg-zinc-800 ring-1 ring-white/10 group-hover:ring-yellow-500/60 transition">
                          {c.banner_url ? (
                            <img src={c.banner_url} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="truncate text-white group-hover:underline">{c.name}</div>
                      </a>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-28 rounded bg-zinc-800 overflow-hidden">
                          <div className="h-full bg-yellow-500" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-zinc-300">{w.toFixed(1)} / 6</div>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-zinc-300">{t.toFixed(1)}</td>
                    <td className="py-3 text-right">
                      <a
                        href={c.slug ? `/clubs/${c.slug}` : `/clubs/${c.id}`}
                        className="text-yellow-400 hover:underline"
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------
   Playoffs block (refined)
--------------------------- */
function PlayoffsBlock({
  loading,
  clubName,
  seasons,
  seasonId,
  setSeasonId,
  seasonLoading,
  rows,
  youId,
  seeds,
}) {
  return (
    <>
      {/* Encouraging banner */}
      <div className="mt-3 rounded-xl border border-zinc-800 bg-gradient-to-r from-yellow-500/10 via-transparent to-transparent p-3">
        <div className="text-sm text-zinc-300">
          <span className="font-medium text-white">Earn your playoff spot</span> with consistent weekly participation.
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          {`Playoffs${clubName ? " — " + clubName : ""}`}
        </h2>
        <div className="ml-auto flex items-center gap-2 text-xs text-zinc-500">
          <span>Season</span>
          <select
            className="rounded-md bg-black/30 border border-zinc-800 text-xs text-white px-2 py-1"
            value={seasonId || ""}
            onChange={(e) => setSeasonId(e.target.value || null)}
            disabled={seasonLoading}
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/40 p-4">
        {loading ? (
          <div className="h-10 w-full animate-pulse rounded bg-zinc-900" />
        ) : rows.length === 0 ? (
          <div className="text-zinc-400">No leaderboard data for this season.</div>
        ) : (
          <ol className="divide-y divide-zinc-800">
            {rows.map((r, i) => (
              <li
                key={r.user_id}
                className={`flex items-center gap-3 py-3 ${r.user_id === youId ? "bg-white/5 rounded-xl px-3 -mx-3" : ""}`}
              >
                <div className="w-8 text-right text-sm text-zinc-400">{i + 1}</div>
                <div className="h-8 w-8 overflow-hidden rounded-full bg-zinc-800">
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : null}
                </div>
                <div className="flex-1 truncate">
                  <a
                    href={r.slug ? `/u/${r.slug}` : "#"}
                    className="truncate text-sm text-zinc-200 hover:underline"
                  >
                    {r.display_name || "Member"}
                  </a>
                </div>
                <div className="text-sm text-zinc-400 mr-4">
                  +{r.week_points ?? 0} this week
                </div>
                <div className="text-sm font-medium text-white">
                  {r.total_points ?? 0}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Seeds + bracket */}
      <div className="mt-6 rounded-2xl border border-zinc-800 bg-black/40 p-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-white">Top 8 seeds</div>
          <div className="text-xs text-zinc-400">
            From <span className="font-medium text-white">{seasons.find((s) => s.id === seasonId)?.name || "Season"}</span>
          </div>
        </div>

        {seeds.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">Not enough data yet.</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {seeds.map((r, i) => (
                <div key={r.user_id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-black/30 p-2">
                  <div className="w-6 text-right text-[11px] text-zinc-400">#{i + 1}</div>
                  <div className="h-7 w-7 overflow-hidden rounded-full bg-zinc-800">
                    {r.avatar_url ? <img src={r.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-white">{r.display_name || "Member"}</div>
                  </div>
                  <div className="text-xs text-zinc-400">{r.total_points ?? 0} pts</div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-zinc-800 p-4">
              <div className="text-xs uppercase tracking-wide text-zinc-400 mb-2">Bracket</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <QF a={seeds[0]} b={seeds[7]} />
                <QF a={seeds[3]} b={seeds[4]} />
                <div className="rounded-xl border border-zinc-800 bg-black/30 p-3 text-zinc-400">
                  Semis & Final will appear here when fixtures are generated.
                </div>
                <QF a={seeds[2]} b={seeds[5]} />
                <QF a={seeds[1]} b={seeds[6]} />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function QF({ a, b }) {
  if (!a || !b) {
    return <div className="rounded-lg border border-zinc-800 bg-black/30 p-2 text-zinc-500">TBD</div>;
  }
  return (
    <div className="rounded-lg border border-zinc-800 bg-black/30 p-2">
      <Row r={a} />
      <div className="my-1 text-center text-[10px] text-zinc-500">vs</div>
      <Row r={b} />
    </div>
  );
}
function Row({ r }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-6 w-6 rounded-full overflow-hidden bg-zinc-800">
        {r.avatar_url && <img src={r.avatar_url} alt="" />}
      </div>
      <div className="truncate text-white">{r.display_name || "Seed"}</div>
      <div className="ml-auto text-[11px] text-zinc-400">{r.total_points} pts</div>
    </div>
  );
}
