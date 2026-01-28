// src/components/LeaderboardWideCard.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Crown } from "lucide-react";
import supabase from "lib/supabaseClient";
import { useUser } from "../context/UserContext";
import useHydratedSupabaseFetch from "../hooks/useHydratedSupabaseFetch";
import usePrimaryClub from "../hooks/usePrimaryClub";
import { readCache, writeCache } from "../lib/cache";
const STATS_CACHE_PREFIX = "cache:leaderboard:stats:v1:";
const STATS_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export default function LeaderboardWideCard({
  className = "",
  shouldLoad = true, // allow callers to defer data fetching until in-view
  refreshEpoch = 0,
}) {
  const navigate = useNavigate();
  const { profile, sessionLoaded } = useUser();

  const [club, setClub] = useState(null);          // { id, slug, name, avatar }
  const [err, setErr] = useState("");

  // we’ll store the resolved real UUID here to compare on refresh events
  const clubIdRef = useRef(null);
  const statsCacheKey = useMemo(
    () => (club?.id ? `${STATS_CACHE_PREFIX}${club.id}` : null),
    [club?.id]
  );
  const cachedStats = statsCacheKey ? readCache(statsCacheKey, STATS_CACHE_TTL_MS) : null;
  const [shownStats, setShownStats] = useState(cachedStats);

  const { club: primaryClub } = usePrimaryClub({ refreshEpoch });
  const clubId = primaryClub?.id || null;

  useEffect(() => {
    if (!statsCacheKey) {
      return;
    }
    const cached = readCache(statsCacheKey, STATS_CACHE_TTL_MS);
    if (cached) {
      setShownStats(cached);
      if (cached?.club) {
        setClub(cached.club);
        clubIdRef.current = cached.club.id;
      }
    }
  }, [statsCacheKey]);

  const fetcher = useCallback(async () => {
    if (!clubId) return null;
    const { data, error } = await supabase.rpc("get_club_leaderboard_summary", {
      p_club_key: String(clubId),
    });
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }, [clubId]);

  const {
    data: leaderboardRow,
    showSkeleton: statsSkeleton,
    error: leaderboardError,
  } = useHydratedSupabaseFetch(
    fetcher,
    [clubId, refreshEpoch],
    {
      sessionLoaded,
      userId: profile?.id || null,
      initialData: cachedStats || null,
      timeoutMs: 8000,
      enabled: Boolean(shouldLoad && sessionLoaded && clubId),
    }
  );

  useEffect(() => {
    if (!leaderboardRow) return;
    const payload = {
      pointsWeek: leaderboardRow.points_this_week ?? 0,
      clubRank: leaderboardRow.club_rank ?? null,
      club: {
        id: leaderboardRow.club_id,
        slug: leaderboardRow.club_slug || null,
        name: leaderboardRow.club_name || "Club",
        avatar: leaderboardRow.club_avatar || leaderboardRow.club_banner || "",
      },
    };
    setClub(payload.club);
    setShownStats(payload);
    if (payload.club.id) {
      clubIdRef.current = payload.club.id;
      const key = `${STATS_CACHE_PREFIX}${payload.club.id}`;
      writeCache(key, payload);
    }
    setErr("");
  }, [leaderboardRow]);

  useEffect(() => {
    if (!leaderboardError || leaderboardError.message === "no-user") return;
    console.warn("[LeaderboardWideCard] leaderboard RPC failed:", leaderboardError);
    setErr(leaderboardError.message || "Failed to load leaderboard info.");
  }, [leaderboardError]);

  // Not in any club → CTA
  if (!clubId) {
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

  const stats = shownStats;
  const statsShowSkeleton = statsSkeleton && !shownStats;
  const displayPoints = stats?.pointsWeek ?? 0;
  const displayRank = stats?.clubRank ?? null;
  const progressPct = Math.min(100, (displayPoints / 30) * 100);
  const progressLabel = `${displayPoints}`;

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
            {statsShowSkeleton ? (
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
              {statsShowSkeleton ? "—" : (club?.name || "Your Club")}
            </div>
            <div className="truncate text-[11px] text-zinc-400">
              {err ? <span className="text-red-400">{err}</span> : "Tap for full leaderboard & playoffs"}
            </div>
          </div>
        </div>

        {/* Middle: club global rank */}
        <div className="flex items-center justify-center">
          {statsShowSkeleton ? (
            <div className="h-7 w-16 animate-pulse rounded bg-zinc-900" />
          ) : (
            <div className="text-3xl font-bold leading-none text-white">{displayRank ?? "—"}</div>
          )}
        </div>

        {/* Right: club points this week */}
        <div className="flex items-center justify-end">
          {statsShowSkeleton ? (
            <div className="h-7 w-24 animate-pulse rounded bg-zinc-900" />
          ) : (
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-zinc-400">This Week (club)</div>
              <div className="text-lg font-semibold text-white">{displayPoints ?? "—"}</div>
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
