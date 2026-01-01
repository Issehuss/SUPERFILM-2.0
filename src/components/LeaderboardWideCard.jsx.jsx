// src/components/LeaderboardWideCard.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Crown } from "lucide-react";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";
import useMyClubs from "../hooks/useMyClubs";

// UUID detector to avoid 'invalid input syntax for uuid'
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

export default function LeaderboardWideCard({
  className = "",
  shouldLoad = true, // allow callers to defer data fetching until in-view
}) {
  const navigate = useNavigate();
  const { user, profile } = useUser();
  const { myClubs } = useMyClubs();

  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState(null);          // { id, slug, name, avatar }
  const [clubRank, setClubRank] = useState(null);  // rank among all clubs (all-time points)
  const [pointsWeek, setPointsWeek] = useState(null); // this club's points last 7d
  const [err, setErr] = useState("");

  // we’ll store the resolved real UUID here to compare on refresh events
  const clubIdRef = useRef(null);
  const cacheRef = useRef(null);

  const readCache = useCallback((key) => {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.at || !parsed?.data) return null;
      if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
      return parsed.data;
    } catch {
      return null;
    }
  }, []);

  const writeCache = useCallback((key, data) => {
    try {
      sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
    } catch {}
  }, []);

  // Choose a club key (might be UUID or slug)
  const clubKey = useMemo(() => {
    const byProfile = Array.isArray(profile?.joined_clubs) && profile.joined_clubs.length
      ? profile.joined_clubs[0]
      : null;
    const byLocal = localStorage.getItem("activeClubSlug") || localStorage.getItem("activeClubId");
    const byHook = myClubs?.length ? myClubs[0]?.id : null;
    return byProfile || byLocal || byHook || null;
  }, [profile?.joined_clubs, myClubs]);

  const load = useCallback(async (initial = false) => {
    setErr("");
    if (!clubKey) { setLoading(false); return; }
    if (initial) setLoading(true);

    try {
      // 1) Resolve club by id OR slug first (avoid .or(...))
      const selectCols = "id, slug, name, profile_image_url";
      let cRow = null;

      if (UUID_RX.test(String(clubKey))) {
        const { data, error } = await supabase
          .from("clubs")
          .select(selectCols)
          .eq("id", clubKey)
          .maybeSingle();
        if (error) throw error;
        cRow = data;
      } else {
        const { data, error } = await supabase
          .from("clubs")
          .select(selectCols)
          .eq("slug", clubKey)
          .maybeSingle();
        if (error) throw error;
        cRow = data;
      }

      if (!cRow?.id) {
        setClub(null);
        setClubRank(null);
        setPointsWeek(null);
        clubIdRef.current = null;
        setLoading(false);
        return;
      }

      const realClubId = cRow.id;
      clubIdRef.current = realClubId;

      setClub({
        id: realClubId,
        slug: cRow.slug,
        name: cRow.name,
        avatar: cRow.profile_image_url || "",
      });

      const cacheKey = `leaderboard:${realClubId}`;
      const cached = readCache(cacheKey);
      if (cached) {
        setPointsWeek(cached.pointsWeek ?? null);
        setClubRank(cached.clubRank ?? null);
        cacheRef.current = cached;
      }

      // 2) This Week (rolling 7d) total for THIS club — aggregate query
      const sinceISO = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      let weekSum = 0;
      try {
        const { data: weekRows, error: wErr } = await supabase
          .from("point_events")
          .select("points")
          .eq("status", "approved")
          .eq("club_id", realClubId)
          .gte("created_at", sinceISO);
        if (wErr) throw wErr;
        weekSum = (weekRows || []).reduce((acc, r) => acc + (Number(r.points) || 0), 0);
        setPointsWeek(weekSum);
      } catch (eSum) {
        console.warn("[LeaderboardWideCard] week sum error:", eSum?.message || eSum);
        setPointsWeek(0);
      }

      // 3) Global club rank (by all-time approved points) — grouped server-side
      const { data: aggRows, error: aErr } = await supabase
        .from("point_events")
        .select("club_id, points")
        .eq("status", "approved");
      if (aErr) throw aErr;

      const totals = new Map();
      (aggRows || []).forEach((r) => {
        const k = r.club_id;
        totals.set(k, (totals.get(k) || 0) + (Number(r.points) || 0));
      });

      const ordered = Array.from(totals.entries())
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .map(([k]) => String(k));

      const idx = ordered.findIndex((k) => k === String(realClubId));
      const rank = idx >= 0 ? idx + 1 : ordered.length ? ordered.length + 1 : 1;
      setClubRank(rank);

      // cache
      const payload = { pointsWeek: weekSum, clubRank: rank };
      cacheRef.current = payload;
      writeCache(cacheKey, payload);
    } catch (e) {
      const msg = e?.message || "Failed to load leaderboard info.";
      console.warn("[LeaderboardWideCard] load error:", msg);
      setErr(msg);
      setClubRank(null);
      setPointsWeek(null);
    } finally {
      setLoading(false);
    }
  }, [clubKey]);

  // Initial load (show skeleton once)
  useEffect(() => {
    if (!shouldLoad) {
      setLoading(false);
      return;
    }
    load(true);
  }, [load, shouldLoad]);

  // Silent refresh when a "points-updated" event is fired anywhere
  useEffect(() => {
    if (!shouldLoad) return undefined;

    const onBump = (e) => {
      // if an event carries a clubId, only refresh if it matches the resolved club
      const target = e?.detail?.clubId;
      if (target && clubIdRef.current && String(target) !== String(clubIdRef.current)) return;
      load(false);
    };
    window.addEventListener("points-updated", onBump);
    return () => window.removeEventListener("points-updated", onBump);
  }, [load, shouldLoad]);

  // Not in any club → CTA
  if (!clubKey) {
    return (
      <div className={`rounded-2xl border border-zinc-800 bg-black/40 p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-zinc-900 ring-1 ring-zinc-800 grid place-items-center text-zinc-600">
              <Crown size={18} />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Join a club to see your rank</div>
              <div className="text-[12px] text-zinc-400">Your club’s playoff path starts here.</div>
            </div>
          </div>
          <button
            onClick={() => navigate("/clubs")}
            className="rounded-lg bg-yellow-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-yellow-400"
          >
            Browse clubs
          </button>
        </div>
      </div>
    );
  }

  // Right-side progress is only a visual meter (not capped per member here)
  const progressPct = Math.min(100, ((pointsWeek || 0) / 30) * 100); // scale vs 30 for a decent bar
  const progressLabel = `${pointsWeek ?? 0}`;

  return (
    <button
      type="button"
      onClick={() => navigate("/leaderboard")}
      className={`w-full rounded-2xl border border-zinc-800 bg-black/40 px-5 py-4 text-left hover:border-zinc-700 transition ${className}`}
      title="Open Leaderboard & Playoffs"
    >
      <div className="grid grid-cols-3 items-center">
        {/* Left: club avatar (profile picture) */}
        <div className="flex items-center gap-3">
          <a
            href={club?.slug ? `/clubs/${club.slug}` : (club?.id ? `/clubs/${club.id}` : "#")}
            onClick={(e) => e.stopPropagation()}
            title="Open club profile"
            className="relative h-10 w-10 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-zinc-800 block"
          >
            {loading ? (
              <div className="h-full w-full animate-pulse bg-zinc-900" />
            ) : club?.avatar ? (
              <img src={club.avatar} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-zinc-600">
                <Crown size={18} />
              </div>
            )}
          </a>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">
              {loading ? "—" : (club?.name || "Your Club")}
            </div>
            <div className="truncate text-[11px] text-zinc-400">
              {err ? <span className="text-red-400">{err}</span> : "Tap for full leaderboard & playoffs"}
            </div>
          </div>
        </div>

        {/* Middle: club global rank */}
        <div className="flex items-center justify-center">
          {loading ? (
            <div className="h-7 w-16 animate-pulse rounded bg-zinc-900" />
          ) : (
            <div className="text-3xl font-bold leading-none text-white">{clubRank ?? "—"}</div>
          )}
        </div>

        {/* Right: club points this week */}
        <div className="flex items-center justify-end">
          {loading ? (
            <div className="h-7 w-24 animate-pulse rounded bg-zinc-900" />
          ) : (
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-zinc-400">This Week (club)</div>
              <div className="text-lg font-semibold text-white">{pointsWeek ?? "—"}</div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1 w-20 rounded bg-zinc-800 overflow-hidden">
                  <div className="h-full bg-yellow-500" style={{ width: `${progressPct}%` }} />
                </div>
                <div className="text-[11px] text-zinc-400">{progressLabel}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
