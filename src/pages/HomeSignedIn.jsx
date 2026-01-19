// src/pages/HomeSignedIn.jsx
// Fast-first: cache TMDB, fetch once, rotate only when visible; minimal re-renders.
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarClock,
  Film,
  Users,
  PlusCircle,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  Home as HomeIcon,
  User as UserIcon,
} from "lucide-react";
import { useUser } from "../context/UserContext";
import supabase from "../supabaseClient.js";
import useWatchlist from "../hooks/useWatchlist";
import usePageVisibility from "../hooks/usePageVisibility";
import useSafeSupabaseFetch from "../hooks/useSafeSupabaseFetch";
import useAppResume from "../hooks/useAppResume";
import LeaderboardWideCard from "../components/LeaderboardWideCard.jsx";
import { env as ENV } from "../lib/env";
import TmdbImage from "../components/TmdbImage";

/* ------------ skeletons ------------ */
function HomeSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-8 text-white space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
          <div className="h-6 w-40 rounded bg-white/10 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 rounded-full bg-white/10 animate-pulse" />
          <div className="h-10 w-32 rounded-full bg-white/10 animate-pulse" />
        </div>
      </div>

      <div className="h-[38vh] min-h-[300px] rounded-2xl bg-white/10 animate-pulse" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 space-y-4">
          <div className="h-14 rounded-xl bg-white/10 animate-pulse" />
          <div className="h-[260px] rounded-2xl bg-white/10 animate-pulse" />
        </div>
        <div className="col-span-1 h-[420px] rounded-2xl bg-white/10 animate-pulse" />
      </div>

      <div className="h-48 rounded-2xl bg-white/10 animate-pulse" />
    </div>
  );
}

/* ------------ small helpers ------------ */
const CLUB_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='100%' height='100%' fill='%232a2a2a'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-family='Arial' font-size='14'>Club</text></svg>`
  );

const sanitizeClubImage = (url) => {
  if (!url || typeof url !== "string") return CLUB_PLACEHOLDER;
  if (/^https?:\/\//i.test(url)) return url;
  const base = ENV.SUPABASE_URL ? ENV.SUPABASE_URL.replace(/\/$/, "") : "";
  const path = url.replace(/^\/+/, "");
  if (base) return `${base}/storage/v1/object/public/${path}`;
  return CLUB_PLACEHOLDER;
};

function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/* ------------ TMDB proxy (unchanged) ------------ */
async function tmdbProxy(path, query = {}) {
  const cleanPath = String(path || "").startsWith("/") ? path : `/${path || ""}`;
  const isSearch = cleanPath.includes("/search");
  const searchQuery = typeof query?.query === "string" ? query.query.trim() : "";
  if (
    isSearch &&
    (!query ||
      searchQuery.length < 2)
  ) {
    return {};
  }
  try {
    if (isSearch) {
      const { data, error } = await supabase.functions.invoke("tmdb-search", {
        body: { q: searchQuery },
        headers: { "Content-Type": "application/json" },
      });
      if (!error && data) return data;
      if (error) console.warn("[tmdbProxy] invoke error:", error.message || error);
    }
  } catch (e) {
    console.warn("[tmdbProxy] invoke threw:", e?.message || e);
  }

  if (isSearch && ENV.SUPABASE_FUNCTIONS_URL) {
    try {
      const url = `${ENV.SUPABASE_FUNCTIONS_URL.replace(/\/$/, "")}/tmdb-search`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: searchQuery }),
      });
      if (r.ok) return await r.json();
      console.warn("[tmdbProxy] HTTP fallback non-2xx:", r.status, await r.text().catch(() => ""));
    } catch (e) {
      console.warn("[tmdbProxy] HTTP fallback threw:", e?.message || e);
    }
  }

  const qs = new URLSearchParams(Object.entries(query || {})).toString();
  const apiUrl = `${ENV.TMDB_API_BASE || "https://api.themoviedb.org/3"}${cleanPath}${
    qs ? `?${qs}` : ""
  }`;

  if (ENV.TMDB_READ_TOKEN) {
    try {
      const r = await fetch(apiUrl, { headers: { Authorization: `Bearer ${ENV.TMDB_READ_TOKEN}` } });
      if (r.ok) return await r.json();
      console.warn("[tmdbProxy] direct V4 non-2xx:", r.status, await r.text().catch(() => ""));
    } catch (e) {
      console.warn("[tmdbProxy] direct V4 threw:", e?.message || e);
    }
  }

  if (ENV.TMDB_API_KEY) {
    try {
      const join = apiUrl.includes("?") ? "&" : "?";
      const r = await fetch(`${apiUrl}${join}api_key=${encodeURIComponent(ENV.TMDB_API_KEY)}`);
      if (r.ok) return await r.json();
      console.warn("[tmdbProxy] direct V3 non-2xx:", r.status, await r.text().catch(() => ""));
    } catch (e) {
      console.warn("[tmdbProxy] direct V3 threw:", e?.message || e);
    }
  }
  return {};
}

/* ------------ home feed helper ------------ */
const HOME_FEED_LIMIT = 20;
const HOME_FEED_TTL_MS = 2 * 60 * 1000; // 2 minutes
const HOME_FEED_EVENT = "sf:home-feed:new";
const homeFeedMemoryCache = {
  items: null,
  cursor: null,
  ts: 0,
  userId: null,
};
const NEXT_SCREENING_CACHE_KEY = "cache:clubNextScreening:v1";
const NEXT_SCREENING_TTL_MS = 10 * 60 * 1000; // 10 minutes
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => UUID_RX.test(String(v || ""));

function readHomeFeedCache(userId) {
  if (!userId || homeFeedMemoryCache.userId !== userId) return null;
  if (!Array.isArray(homeFeedMemoryCache.items)) return null;
  if (Date.now() - homeFeedMemoryCache.ts > HOME_FEED_TTL_MS) return null;
  return {
    items: homeFeedMemoryCache.items,
    cursor: homeFeedMemoryCache.cursor ?? null,
  };
}

function writeHomeFeedCache(userId, items, cursor) {
  homeFeedMemoryCache.items = items;
  homeFeedMemoryCache.cursor = cursor ?? null;
  homeFeedMemoryCache.ts = Date.now();
  homeFeedMemoryCache.userId = userId || null;
}

function readNextScreeningCache(clubId) {
  if (!clubId) return null;
  try {
    const raw = sessionStorage.getItem(`${NEXT_SCREENING_CACHE_KEY}:${clubId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || !parsed?.title) return null;
    if (Date.now() - parsed.at > NEXT_SCREENING_TTL_MS) return null;
    return parsed.title;
  } catch {
    return null;
  }
}

function writeNextScreeningCache(clubId, title) {
  if (!clubId) return;
  try {
    sessionStorage.setItem(
      `${NEXT_SCREENING_CACHE_KEY}:${clubId}`,
      JSON.stringify({ at: Date.now(), title })
    );
  } catch {
    /* ignore cache errors */
  }
}

const ENABLE_CURATIONS =
  (typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_ENABLE_CURATIONS === "true") ||
  false;

/* ------------ lightweight cache ------------ */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const NOW_PLAYING_CACHE_KEY = "tmdb:nowPlaying:GB:v2";
const DECK_ROTATE_MS = 2500; // rotation interval for "In Cinemas This Week"
function readCache(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw);
    if (!at || !data) return null;
    if (Date.now() - at > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}
function writeCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {}
}

function getFeedHref(item) {
  const slug = item?.club_slug || item?.club?.slug || null;
  const id = item?.club_id || item?.club?.id || null;
  if (slug) return `/clubs/${slug}`;
  if (id) return `/clubs/${id}`;
  return "/clubs";
}

function getFeedAvatar(item, fallback) {
  return (
    item?.actor_avatar ||
    item?.actor_avatar_url ||
    item?.actor?.avatar_url ||
    item?.club_avatar ||
    fallback ||
    "/avatar_placeholder.png"
  );
}

function getFeedSummary(item) {
  return item?.summary || item?.text || item?.message || "";
}

function getFeedCreatedAt(item) {
  return item?.created_at || item?.createdAt || item?.ts || null;
}

export default function HomeSignedIn() {
  const { user, profile, isReady } = useUser();
  const navigate = useNavigate();

  /* ============ refs for perf control ============ */
  const deckRef = useRef(null);
  const rotateTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const deckVisibleRef = useRef(false);
  const hoverRef = useRef(false);
  const leaderboardRef = useRef(null);

  /* ============ state ============ */
  const [memberships, setMemberships] = useState([]);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  const [club, setClub] = useState(null);

  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [activityHasMore, setActivityHasMore] = useState(true);
  const activityCursorRef = useRef(null);
  const activitySentinelRef = useRef(null);
  const [feedRequest, setFeedRequest] = useState({ key: 0, cursor: null, append: false });
  const [nextFromClub, setNextFromClub] = useState(null);

  const [curated, setCurated] = useState([]);
  const [nowPlaying, setNowPlaying] = useState([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [deckLoading, setDeckLoading] = useState(true);

  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [selfDisplay, setSelfDisplay] = useState(null);
  const recentActivity = useMemo(() => (activity || []).slice(0, 3), [activity]);
  const clubImage = useMemo(() => {
    if (!club) return CLUB_PLACEHOLDER;
    const src =
      club?.profile_image_url ||
      club?.image ||
      null;
    return sanitizeClubImage(src);
  }, [club]);

  const {
    items: homeWatchlist,
    loading: wlLoading,
    add,
    remove,
  } = useWatchlist(user?.id);

  const [wlIndex, setWlIndex] = useState(0);
  const [wlMeta, setWlMeta] = useState({});
  const [leaderboardReady, setLeaderboardReady] = useState(false);
  const isPageVisible = usePageVisibility();
  const resumeTick = useAppResume();

  const {
    data: selfDisplayData,
    error: selfDisplayError,
  } = useSafeSupabaseFetch(
    async (session) => {
      const resolvedUserId = user?.id || session?.user?.id;
      const { data, error } = await supabase.rpc("get_profile_display", {
        p_user_id: resolvedUserId,
      });
      if (error) throw error;
      return data || null;
    },
    [user?.id, resumeTick],
    { enabled: true, timeoutMs: 8000, initialData: null }
  );

  useEffect(() => {
    if (selfDisplayData) {
      setSelfDisplay(selfDisplayData);
      return;
    }
    if (selfDisplayError) {
      setSelfDisplay(null);
    }
  }, [selfDisplayData, selfDisplayError]);

  /* ============ memberships -> primary club ============ */
  const {
    data: membershipsResult,
    loading: membershipsFetchLoading,
    error: membershipsFetchError,
  } = useSafeSupabaseFetch(
    async (session) => {
      const resolvedUserId = user?.id || session?.user?.id;
      if (!resolvedUserId || !isUuid(resolvedUserId)) throw new Error("no-user");
      const { data, error } = await supabase
        .from("club_members")
        .select("club_id, user_id, role, joined_at, accepted")
        .eq("user_id", resolvedUserId);
      if (error) throw error;

      const clubIds = (data || []).map((row) => row.club_id).filter(Boolean);
      let clubsMap = {};
      if (clubIds.length) {
        const { data: clubsData } = await supabase
          .from("clubs_public")
          .select("id, slug, name, profile_image_url")
          .in("id", clubIds);
        clubsMap = (clubsData || []).reduce((acc, c) => {
          acc[c.id] = c;
          return acc;
        }, {});
      }

      return (data || []).map((row) => ({
        ...row,
        clubs: clubsMap[row.club_id] || null,
      }));
    },
    [user?.id, isReady, resumeTick],
    { enabled: true, timeoutMs: 8000 }
  );

  useEffect(() => {
    setMembershipsLoading(membershipsFetchLoading);
  }, [membershipsFetchLoading]);

  useEffect(() => {
    if (membershipsResult) {
      setMemberships(membershipsResult);
      return;
    }
    if (membershipsFetchError && membershipsFetchError.message !== "no-user") {
      console.error("[HomeSignedIn] club_members fetch error:", membershipsFetchError.message);
      setMemberships([]);
    }
  }, [membershipsResult, membershipsFetchError]);

  const myClubs = useMemo(
    () => (memberships || []).map((m) => m?.clubs).filter(Boolean),
    [memberships]
  );

  useEffect(() => {
    setClub((prev) => {
      const next = myClubs?.[0] || null;
      return prev?.id === next?.id ? prev : next;
    });
  }, [myClubs]);

  const {
    data: feedResult,
    loading: feedLoading,
    error: feedError,
    timedOut: feedTimedOut,
    retry: retryFeed,
  } = useSafeSupabaseFetch(
    async (session) => {
      if (!feedRequest.key) return null;
      const resolvedUserId = user?.id || session?.user?.id;
      if (!resolvedUserId) throw new Error("no-user");
      const { data, error } = await supabase.rpc("get_home_feed", {
        p_limit: HOME_FEED_LIMIT,
        p_cursor: feedRequest.cursor ?? null,
      });
      if (error) throw error;
      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.items)
        ? data.items
        : [];
      const lastCreatedAt = rows.length
        ? getFeedCreatedAt(rows[rows.length - 1])
        : feedRequest.cursor;
      return {
        rows,
        cursor: lastCreatedAt,
        append: feedRequest.append,
        userId: resolvedUserId,
      };
    },
    [feedRequest.key, feedRequest.cursor, feedRequest.append, user?.id, resumeTick],
    { enabled: feedRequest.key > 0, timeoutMs: 8000 }
  );

  /* ============ 2) home feed via RPC ============ */
  useEffect(() => {
    let cancelled = false;
    const loadCache = async () => {
      const { data: auth } = await supabase.auth.getSession();
      const sessionUserId = auth?.session?.user?.id || null;
      const resolvedUserId = user?.id || sessionUserId;
      if (!resolvedUserId) return;
      const cached = readHomeFeedCache(resolvedUserId);
      if (cached?.items?.length && !cancelled) {
        setActivity(cached.items);
        activityCursorRef.current = cached.cursor ?? null;
        setActivityLoading(false);
      }
      if (!cancelled) {
        setFeedRequest((prev) =>
          prev.key
            ? prev
            : { key: Date.now(), cursor: null, append: false }
        );
      }
    };
    loadCache();
    return () => {
      cancelled = true;
    };
  }, [user?.id, resumeTick]);

  useEffect(() => {
    if (!feedResult) return;
    const rows = feedResult.rows || [];
    setActivity((prev) => {
      const next = feedResult.append ? [...prev, ...rows] : rows;
      writeHomeFeedCache(feedResult.userId, next, feedResult.cursor);
      return next;
    });
    activityCursorRef.current = feedResult.cursor;
    setActivityHasMore(rows.length === HOME_FEED_LIMIT);
  }, [feedResult]);

  useEffect(() => {
    if (feedError && feedError.message !== "no-user") {
      console.warn("home feed (rpc) failed:", feedError);
      setActivityHasMore(false);
    }
  }, [feedError]);

  useEffect(() => {
    if (feedTimedOut) {
      setActivityHasMore(false);
    }
  }, [feedTimedOut]);

  useEffect(() => {
    if (feedRequest.append) {
      setActivityLoadingMore(feedLoading);
      return;
    }
    setActivityLoading(feedLoading);
  }, [feedLoading, feedRequest.append]);

  useEffect(() => {
    const el = activitySentinelRef.current;
    if (!el || activityLoading || activityLoadingMore || !activityHasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        const cursor = activityCursorRef.current || null;
        if (!cursor || activityLoadingMore) return;
        setFeedRequest({ key: Date.now(), cursor, append: true });
      },
      { rootMargin: "300px 0px", threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [activityLoading, activityLoadingMore, activityHasMore]);

  useEffect(() => {
    const onNew = (evt) => {
      (async () => {
        const payload = evt?.detail;
        if (!payload) return;
        const { data: auth } = await supabase.auth.getSession();
        const sessionUserId = auth?.session?.user?.id || null;
        const resolvedUserId = user?.id || sessionUserId;
        if (!resolvedUserId) return;
        setActivity((prev) => {
          const next = [payload, ...(prev || [])];
          writeHomeFeedCache(resolvedUserId, next, activityCursorRef.current);
          return next;
        });
        setFeedRequest({ key: Date.now(), cursor: null, append: false });
      })();
    };
    window.addEventListener(HOME_FEED_EVENT, onNew);
    return () => window.removeEventListener(HOME_FEED_EVENT, onNew);
  }, [user?.id]);

  /* ============ 3) small club fetch ============ */
  useEffect(() => {
    const cachedNext = readNextScreeningCache(club?.id);
    if (cachedNext) {
      setNextFromClub(cachedNext);
    }
  }, [club?.id]);

  const { data: nextScreeningRow } = useSafeSupabaseFetch(
    async () => {
      if (!club?.id) throw new Error("no-club");
      const { data, error } = await supabase
        .from("club_next_screening_v")
        .select("club_id, title, poster_path, screening_at, location")
        .eq("club_id", club.id)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },
    [club?.id, resumeTick],
    { enabled: Boolean(club?.id), timeoutMs: 8000 }
  );

  useEffect(() => {
    const title = nextScreeningRow?.title || null;
    setNextFromClub(title);
    if (title && club?.id) writeNextScreeningCache(club.id, title);
  }, [nextScreeningRow, club?.id]);

  /* ============ 4) TMDB deck (fetch once + cache) ============ */
  useEffect(() => {
    mountedRef.current = true;

    const CACHE_KEY = ENABLE_CURATIONS
      ? "home:curations:GB:v1"
      : NOW_PLAYING_CACHE_KEY;

    (async () => {
      setDeckLoading(true);

      // try cache first
      const cached = readCache(CACHE_KEY);
      if (cached?.list?.length) {
        if (!mountedRef.current) return;
        if (ENABLE_CURATIONS) setCurated(cached.list);
        else setNowPlaying(cached.list);
        setDeckIndex(0);
        setDeckLoading(false);
        return;
      }

      try {
        if (ENABLE_CURATIONS) {
          const today = new Date().toISOString().split("T")[0];
          const { data } = await supabase
            .from("cinema_curations")
            .select("id, tmdb_id, title_override, backdrop_override, description, order_index")
            .eq("is_active", true)
            .eq("region", "GB")
            .lte("start_date", today)
            .gte("end_date", today)
            .order("order_index", { ascending: true });

          const enriched = await Promise.all(
            (data || []).map(async (row) => {
              let tmdb = {};
              try {
                tmdb = (await tmdbProxy(`/movie/${row.tmdb_id}`, { language: "en-GB" })) || {};
              } catch {}
              const override = row.backdrop_override && row.backdrop_override.trim();
              const chosenBackdrop = override || tmdb.backdrop_path || tmdb.poster_path || null;
              return {
                id: row.tmdb_id,
                title: row.title_override || tmdb.title || "",
                backdrop_path: chosenBackdrop,
                release_date: tmdb.release_date || null,
                overview: row.description || tmdb.overview || "",
                poster_path: tmdb.poster_path || null,
              };
            })
          );

          const list = enriched || [];
          writeCache(CACHE_KEY, { list });
          if (!mountedRef.current) return;
          setCurated(list);
          setDeckIndex(0);
        } else {
          const json = await tmdbProxy("/movie/now_playing", {
            language: "en-GB",
            region: "GB",
            page: 1,
          });

          const today = new Date();
          const minus14 = new Date(today);
          minus14.setDate(today.getDate() - 14);
          const plus7 = new Date(today);
          plus7.setDate(today.getDate() + 7);

          const raw = (json?.results || []).filter((m) => m.backdrop_path);
          let list = raw
            .filter((m) => {
              const d = new Date(m.release_date || today);
              return d >= minus14 && d <= plus7;
            })
            .map((m) => ({
              id: m.id,
              title: m.title,
              backdrop_path: m.backdrop_path,
              release_date: m.release_date,
              overview: m.overview || "",
              poster_path: m.poster_path || null,
            }));

          if (!list.length) {
            list = raw.slice(0, 10).map((m) => ({
              id: m.id,
              title: m.title,
              backdrop_path: m.backdrop_path,
              release_date: m.release_date,
              overview: m.overview || "",
              poster_path: m.poster_path || null,
            }));
          }

          writeCache(CACHE_KEY, { list });
          if (!mountedRef.current) return;
          setNowPlaying(list);
          setDeckIndex(0);
        }
      } catch (e) {
        console.error("TMDB fetch failed", e);
      } finally {
        if (mountedRef.current) setDeckLoading(false);
      }
    })();

    return () => {
      mountedRef.current = false;
      // clear any timers in case
      if (rotateTimerRef.current) {
        clearInterval(rotateTimerRef.current);
        rotateTimerRef.current = null;
      }
    };
    // deliberately run ONCE on mount — no deps to avoid re-fetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============ 5) Deck controls (no frequent re-renders) ============ */
  const deckItems = useMemo(() => {
    const list = ENABLE_CURATIONS ? curated : nowPlaying;
    if (!list?.length) return [];
    if (list.length === 1) return [list[0], list[0], list[0]];
    if (list.length === 2) return [...list, ...list];
    return list;
  }, [curated, nowPlaying]);

  const currentMovie = deckItems.length ? deckItems[deckIndex % deckItems.length] : null;

  const nextDeck = useCallback(() => {
    if (!deckItems.length) return;
    setDeckIndex((i) => (i + 1) % deckItems.length);
  }, [deckItems.length]);

  const prevDeck = useCallback(() => {
    if (!deckItems.length) return;
    setDeckIndex((i) => (i - 1 + deckItems.length) % deckItems.length);
  }, [deckItems.length]);

  // IntersectionObserver + Page Visibility to pause rotations
  useEffect(() => {
    const el = deckRef.current;
    if (!el) return;

    const onVisibility = () => {
      const visible = document.visibilityState === "visible";
      deckVisibleRef.current = visible && !hoverRef.current;
      restartRotateTimer();
    };

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const onScreen = entry?.isIntersecting;
        deckVisibleRef.current = onScreen && document.visibilityState === "visible" && !hoverRef.current;
        restartRotateTimer();
      },
      { threshold: 0.2 }
    );

    document.addEventListener("visibilitychange", onVisibility);
    io.observe(el);

    function restartRotateTimer() {
      if (rotateTimerRef.current) {
        clearInterval(rotateTimerRef.current);
        rotateTimerRef.current = null;
      }
      if (deckVisibleRef.current && deckItems.length >= 3) {
        rotateTimerRef.current = setInterval(() => nextDeck(), DECK_ROTATE_MS);
      }
    }

    // initial kickoff
    restartRotateTimer();

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      try {
        io.disconnect();
      } catch {}
      if (rotateTimerRef.current) {
        clearInterval(rotateTimerRef.current);
        rotateTimerRef.current = null;
      }
    };
  }, [deckItems.length, nextDeck]);

  /* ============ 6) Leaderboard (safe fetch) ============ */
  const {
    data: leaderboardResult,
    loading: leaderboardLoading,
    error: leaderboardError,
  } = useSafeSupabaseFetch(
    async () => {
      const { data: clubs } = await supabase
        .from("clubs_public")
        .select("id, name, banner_url")
        .limit(20);

      if (!clubs?.length) return [];

      const now = new Date();
      const rows = await Promise.all(
        clubs.map(async (c) => {
          if (!isUuid(c?.id)) {
            return null;
          }
          const mem = await supabase
            .from("club_members")
            .select("club_id, user_id, role, joined_at, accepted", { count: "exact", head: true })
            .eq("club_id", c.id);
          const members = mem?.count || 0;

          const events30 = 0;

          const d7 = new Date(now);
          d7.setDate(now.getDate() - 7);
          const act = await supabase
            .from("activity")
            .select("id", { count: "exact", head: true })
            .eq("club_id", c.id)
            .gte("created_at", d7.toISOString());
          const activity7 = act?.count || 0;

          const score = members * 3 + events30 * 4 + activity7 * 1;

          return {
            id: c.id,
            name: c.name,
            banner_url: c.banner_url,
            members,
            events30,
            activity7,
            score,
          };
        })
      );

      const filtered = rows.filter(Boolean);
      filtered.sort((a, b) => b.score - a.score);
      return filtered.slice(0, 10);
    },
    [leaderboardReady, resumeTick],
    { enabled: leaderboardReady, timeoutMs: 8000, initialData: [] }
  );

  useEffect(() => {
    setLoadingLeaderboard(leaderboardLoading);
  }, [leaderboardLoading]);

  useEffect(() => {
    if (leaderboardResult) {
      setLeaderboard(leaderboardResult);
    }
  }, [leaderboardResult]);

  useEffect(() => {
    if (leaderboardError) {
      console.warn("leaderboard fetch failed", leaderboardError);
      setLeaderboard([]);
    }
  }, [leaderboardError]);

  /* ============ 7) Watchlist bits (slower rotation) ============ */
  useEffect(() => {
    setWlIndex((i) => {
      if (!homeWatchlist?.length) return 0;
      return i % homeWatchlist.length;
    });
  }, [homeWatchlist?.length]);

  // Only load leaderboard card once it scrolls into view (avoids heavy queries on page load)
  useEffect(() => {
    if (leaderboardReady) return;
    const el = leaderboardRef.current;
    if (!el) return;

    const onVisible = (entries) => {
      const entry = entries[0];
      if (entry?.isIntersecting) {
        setLeaderboardReady(true);
      }
    };

    const obs = new IntersectionObserver(onVisible, { threshold: 0.25 });
    obs.observe(el);

    // Fallback: if idle for a while, just load
    const idleId =
      typeof window !== "undefined" && "requestIdleCallback" in window
        ? window.requestIdleCallback(() => setLeaderboardReady(true), { timeout: 6000 })
        : setTimeout(() => setLeaderboardReady(true), 6000);

    return () => {
      try {
        obs.disconnect();
      } catch {}
      if (typeof idleId === "number") {
        clearTimeout(idleId);
      } else if (idleId && typeof window !== "undefined") {
        window.cancelIdleCallback?.(idleId);
      }
    };
  }, [leaderboardReady]);

  useEffect(() => {
    if (!homeWatchlist || homeWatchlist.length <= 1) return;
    if (!isPageVisible) return;
    const t = setInterval(() => {
      setWlIndex((i) => (i + 1) % homeWatchlist.length);
    }, 5000);
    return () => clearInterval(t);
  }, [homeWatchlist, isPageVisible]);

  const wlCurrent = homeWatchlist?.[wlIndex] || null;
  const wlId = wlCurrent ? wlCurrent.id ?? wlCurrent.movie_id : null;
  const wlPoster = wlCurrent?.poster_path
    ? wlCurrent.poster_path.startsWith("http")
      ? wlCurrent.poster_path
      : `https://image.tmdb.org/t/p/w342${wlCurrent.poster_path}`
    : null;

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!wlId || wlMeta[wlId]) return;
      try {
        const details = await tmdbProxy(`/movie/${wlId}`, { language: "en-GB" });
        if (!ignore) {
          setWlMeta((m) => ({
            ...m,
            [wlId]: {
              overview: details?.overview || "",
              release_date: details?.release_date || null,
            },
          }));
        }
      } catch {}
    })();
    return () => { ignore = true; };
  }, [wlId, wlMeta]);

  const wlOverview = wlId ? wlMeta[wlId]?.overview : "";
  const wlRelease = wlId ? wlMeta[wlId]?.release_date : null;

  async function addToWatchlist(movie) {
    if (!movie) return;
    const id = movie.id ?? movie.tmdb_id ?? movie.movie_id ?? movie?.data?.id ?? null;
    const title = movie.title ?? movie?.data?.title ?? "";
    const poster_path =
      movie.poster_path ?? movie?.data?.poster_path ?? movie.posterPath ?? "";
    const release_date = movie.release_date ?? movie?.data?.release_date ?? null;
    if (!id) return;
    const res = await add({ id: Number(id), title, poster_path, release_date });
    if (res?.error) console.warn("[HomeSignedIn] addToWatchlist failed:", res.error);
  }

  async function removeFromWatchlist(movieId) {
    if (!movieId) return;
    if (typeof remove === "function") {
      const res = await remove(movieId);
      if (res?.error) console.warn("[HomeSignedIn] removeFromWatchlist failed:", res.error);
      return;
    }
    console.warn("[HomeSignedIn] useWatchlist.remove is not available");
  }

  const watchlistIds = useMemo(
    () => new Set((homeWatchlist || []).map((m) => m.id ?? m.movie_id)),
    [homeWatchlist]
  );
  const currentIsSaved = currentMovie ? watchlistIds.has(currentMovie.id) : false;

  const displayName = selfDisplay?.display_name || "Member";

  if (!isReady || !profile) {
    return <HomeSkeleton />;
  }

  /* ============ render ============ */
  return (
    <>
    <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-8 pb-24 sm:pb-8 text-white">
      {/* Welcome + Quick actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="w-full">
          <p className="text-sm text-zinc-400">Welcome back</p>
          <h1 className="text-2xl md:text-3xl font-bold">{displayName}</h1>
        </div>
        <div className="flex flex-row flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
          <Link
            to="/movies"
            className="inline-flex justify-center items-center gap-2 rounded-full bg-yellow-500 px-4 py-2 text-black font-semibold hover:bg-yellow-400 w-auto min-w-[150px]"
          >
            <PlusCircle size={18} /> Add to Watchlist
          </Link>
          <Link
            to={club ? `/clubs/${club.slug || club.id}` : "/clubs"}
            className="inline-flex justify-center items-center gap-2 rounded-full bg-white/10 px-4 py-2 hover:bg-white/15 w-auto min-w-[150px]"
          >
            <Users size={18} /> {club ? "Go to Club" : "Find a Club"}
          </Link>
        </div>
      </div>

      {/* NOW IN CINEMAS — instant shell, cached content */}
      <section className="mt-6 rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 md:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Film className="text-yellow-400" /> In Cinemas This Week
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={prevDeck}
              className="rounded-full bg-white/10 hover:bg-white/15 p-2 disabled:opacity-50"
              disabled={deckLoading || deckItems.length === 0}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={nextDeck}
              className="rounded-full bg-white/10 hover:bg-white/15 p-2 disabled:opacity-50"
              disabled={deckLoading || deckItems.length === 0}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Deck */}
        <div
          ref={deckRef}
          className="relative mt-4 h-[32vh] min-h-[220px] sm:h-[36vh] sm:min-h-[300px] overflow-hidden rounded-xl sm:rounded-2xl"
          onMouseEnter={() => {
            hoverRef.current = true;
            // pause rotation on hover
            if (rotateTimerRef.current) {
              clearInterval(rotateTimerRef.current);
              rotateTimerRef.current = null;
            }
          }}
          onMouseLeave={() => {
            hoverRef.current = false;
            // resume if visible
            if (deckVisibleRef.current && deckItems.length >= 3 && !rotateTimerRef.current) {
              rotateTimerRef.current = setInterval(() => {
                setDeckIndex((i) => (i + 1) % deckItems.length);
              }, 6000);
            }
          }}
        >
          {deckLoading ? (
            <div className="absolute inset-0 rounded-2xl bg-white/5 animate-pulse" />
          ) : deckItems.length === 0 ? (
            <div className="absolute inset-0 rounded-2xl border border-white/10 bg-white/5 grid place-items-center text-sm text-zinc-400">
              No films found.
            </div>
          ) : (
            (() => {
              const n = deckItems.length;
              const prevIndex = (deckIndex - 1 + n) % n;
              const nextIndex = (deckIndex + 1) % n;
              const visible = [prevIndex, deckIndex, nextIndex];

              return visible.map((idx) => {
                const m = deckItems[idx];
                if (!m) return null;

                const role =
                  idx === deckIndex ? "center" : idx === prevIndex ? "left" : "right";

                const widthClass =
                  role === "center"
                    ? "w-[74%] md:w-[72%] lg:w-[70%]"
                    : "w-[50%] md:w-[46%] lg:w-[42%]";

                const baseTransform =
                  role === "center"
                    ? "translate(-50%, -50%) scale(1)"
                    : role === "left"
                    ? "translate(-115%, -50%) scale(0.92)"
                    : "translate(15%, -50%) scale(0.92)";

                const zIndex = role === "center" ? 30 : 20;
                const opacity = role === "center" ? 1 : 0.9;
                const blur = role === "center" ? 0 : 1.1;

                let img = "";
                if (m.backdrop_path) {
                  img = String(m.backdrop_path).startsWith("http")
                    ? m.backdrop_path
                    : `https://image.tmdb.org/t/p/w1280${m.backdrop_path}`;
                } else if (m.poster_path) {
                  img = String(m.poster_path).startsWith("http")
                    ? m.poster_path
                    : `https://image.tmdb.org/t/p/w780${m.poster_path}`;
                }

                return (
                  <div
                    key={m.id}
                    className={`group absolute top-1/2 left-1/2 ${widthClass} -translate-x-1/2 -translate-y-1/2 rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl backdrop-blur-sm bg-white/5`}
                    style={{
                      transform: baseTransform,
                      zIndex,
                      opacity,
                      filter: `blur(${blur}px)`,
                      transition:
                        "transform 500ms cubic-bezier(0.33, 1, 0.68, 1), opacity 400ms ease, filter 400ms ease",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      if (role === "left") setDeckIndex(prevIndex);
                      else if (role === "right") setDeckIndex(nextIndex);
                      else navigate(`/movie/${m.id}`);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={
                      role === "center"
                        ? `${m.title} — open details`
                        : role === "left"
                        ? `Show previous`
                        : `Show next`
                    }
                  >
                    <div className="h-[38vh] min-h-[300px] w-full transition-transform duration-300 group-hover:scale-[1.03]">
                      {img ? (
                        <TmdbImage
                          src={img}
                          alt={m.title}
                          className="block h-full w-full"
                          imgClassName="object-cover"
                          draggable={false}
                          loading="eager"
                          decoding="async"
                        />
                      ) : (
                        <div className="h-full w-full bg-white/10" />
                      )}
                    </div>
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/5" />
                  </div>
                );
              });
            })()
          )}
        </div>

        {/* Actions + description */}
        {!deckLoading && currentMovie && (
          <>
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 text-sm sm:text-base text-zinc-300 px-2 text-center sm:text-left">
              <span className="font-medium text-base sm:text-lg">{currentMovie.title}</span>
              {currentMovie.release_date && (
                <span className="text-zinc-400 text-sm sm:text-base">
                  • releases {new Date(currentMovie.release_date).toLocaleDateString()}
                </span>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() =>
                    currentIsSaved
                      ? removeFromWatchlist(currentMovie.id)
                      : addToWatchlist(currentMovie)
                  }
                  className={`px-4 py-2 rounded-full font-semibold min-w-[150px] ${
                    currentIsSaved
                      ? "bg-white/15 text-white hover:bg-white/20"
                      : "bg-yellow-500 text-black hover:bg-yellow-400"
                  }`}
                >
                  {currentIsSaved ? "Remove" : "Add to Watchlist"}
                </button>
                <button
                  onClick={() => navigate(`/movie/${currentMovie.id}`)}
                  className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 min-w-[140px]"
                >
                  Open details
                </button>
              </div>
            </div>
            {currentMovie.overview && (
              <p className="mt-2 max-w-3xl mx-auto text-center sm:text-left text-zinc-400 text-sm sm:text-base leading-relaxed px-3">
                {currentMovie.overview}
              </p>
            )}
          </>
        )}
      </section>

      {/* 3-column area */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Club card */}
        <section className="col-span-1 lg:col-span-2 rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Film className="text-yellow-400" />
              <div className="flex flex-col">
                <h2 className="text-xl font-semibold">
                  {membershipsLoading ? "Loading club..." : club?.name || "Join a Club"}
                </h2>
                {club?.slug && (
                  <span className="text-xs text-zinc-400">ID: {club.slug || club.id}</span>
                )}
              </div>
            </div>
            {club ? (
              <Link
                to={`/clubs/${club.slug || club.id}`}
                className="text-sm text-yellow-400 hover:underline"
              >
                Open
              </Link>
            ) : (
              <Link to="/clubs" className="text-sm text-yellow-400 hover:underline">
                Browse clubs
              </Link>
            )}
          </div>

          <div className="relative w-full flex items-center justify-center py-10">
            {membershipsLoading ? (
              <div className="h-28 w-28 md:h-32 md:w-32 rounded-full bg-white/10 animate-pulse" />
            ) : club ? (
              <img
                src={clubImage}
                alt={club ? `${club.name} avatar` : "Club placeholder"}
                className="h-28 w-28 md:h-32 md:w-32 rounded-full object-cover ring-2 ring-white/20"
                onError={(e) => {
                  e.currentTarget.src = CLUB_PLACEHOLDER;
                }}
              />
            ) : (
              <div className="h-28 w-28 md:h-32 md:w-32 rounded-full bg-white/5 ring-2 ring-white/10 grid place-items-center text-xs text-zinc-400">
                No club yet
              </div>
            )}
          </div>

          <div className="p-5 border-t border-white/10">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <CalendarClock size={18} /> Upcoming
            </h3>
            {membershipsLoading ? (
              <div className="h-4 w-32 rounded bg-white/10 animate-pulse" />
            ) : nextFromClub ? (
              <p className="text-sm font-semibold text-yellow-400">{nextFromClub}</p>
            ) : (
              <p className="text-sm text-zinc-400">No screenings scheduled yet.</p>
            )}
          </div>
        </section>

        {/* Watchlist card */}
        <section className="col-span-1 rounded-2xl bg-white/5 ring-1 ring-white/10">
          <div className="p-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your Watchlist</h2>
            <Link to="/profile" className="text-sm text-yellow-400 hover:underline">
              See all
            </Link>
          </div>

          <div className="p-5 pt-0">
            {wlLoading ? (
              <div className="h-[380px] md:h-[440px] rounded-xl bg-white/10 animate-pulse" />
            ) : !homeWatchlist?.length ? (
              <div className="h-[380px] md:h-[440px] rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-sm text-zinc-400">
                Add films to your watchlist.
              </div>
            ) : (
              <div className="relative h-[420px] md:h-[520px] rounded-xl ring-1 ring-white/10 p-3 overflow-hidden">
                <Link
                  to={`/movie/${wlCurrent?.id ?? wlCurrent?.movie_id}`}
                  className="flex h-full w-full flex-col items-center justify-start"
                  title={wlCurrent?.title || ""}
                  aria-label={wlCurrent?.title || "Watchlist item"}
                >
                  <div className="flex-1 flex items-center justify-center w-full">
                  <div className="aspect-[2/3] h-[72%] sm:h-[86%] w-[72%] sm:w-[78%] mx-auto">
                    {wlPoster ? (
                      <TmdbImage
                        key={`${wlCurrent?.id || wlCurrent?.movie_id}-${wlIndex}`}
                        src={wlPoster}
                        alt={wlCurrent?.title || "Poster"}
                        className="h-full w-full"
                        imgClassName="h-full w-full object-contain rounded-lg shadow-lg transition-opacity duration-500 opacity-100"
                        draggable={false}
                      />
                    ) : (
                      <div className="h-full w-full bg-white/10 rounded-lg" />
                    )}
                  </div>
                </div>

                  <div className="mt-3 w-full text-center">
                    <div className="text-sm font-semibold line-clamp-1">
                      {wlCurrent?.title || ""}
                    </div>
                    {wlRelease && (
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        {new Date(wlRelease).toLocaleDateString()}
                      </div>
                    )}
                    {wlOverview ? (
                      <p className="mt-1 text-[12px] text-zinc-400 line-clamp-3 leading-snug">
                        {wlOverview}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Activity */}
        <section className="col-span-1 lg:col-span-2 rounded-2xl bg-white/5 ring-1 ring-white/10">
          <div className="p-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent Activity</h2>
            {club && (
              <Link
                to={`/clubs/${club.slug || club.id}`}
                className="text-sm text-yellow-400 hover:underline"
              >
                Open club
              </Link>
            )}
          </div>

          {activityLoading && (
            <div className="px-5 pb-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-white/10 animate-pulse" />
              ))}
            </div>
          )}

          {!activityLoading && activity.length === 0 && (
            <div className="px-5 pb-5">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-zinc-300">
                  See here what your clubs have been up to — messages, updates, and more will
                  appear live.
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Tip: join a club or say hello in chat to get things started.
                </p>
              </div>
            </div>
          )}

          {!activityLoading && activity.length > 0 && (
            <ul className="divide-y divide-white/10">
              {recentActivity.map((a) => (
                <li key={a.id}>
                  <Link
                    to={getFeedHref(a)}
                    className="p-5 flex items-center gap-3 hover:bg-white/5 transition-colors"
                  >
                    <img
                      src={getFeedAvatar(a, club?.banner_url)}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                    />
                    <div className="flex-1 text-left">
                      <div className="text-sm">{getFeedSummary(a)}</div>
                      <div className="text-xs text-zinc-500">
                        {getFeedCreatedAt(a) ? formatDateTime(getFeedCreatedAt(a)) : ""}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* No infinite scroll here; show only the 3 most recent items. */}
        </section>
      </div>

      {/* Leaderboard */}
      <div className="px-7 pt-7" ref={leaderboardRef}>
        <LeaderboardWideCard shouldLoad={leaderboardReady} />
      </div>

      {/* Bottom Quick actions */}
      <div className="mt-8 flex flex-wrap gap-3" />
    </div>

    {/* Mobile bottom nav */}
    <nav
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-black/80 backdrop-blur-xl border-t border-white/10"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
    >
      <div className="mx-auto max-w-5xl px-4 py-2 flex items-center justify-around text-zinc-200">
        <Link to="/" className="flex flex-col items-center gap-1 text-xs">
          <HomeIcon size={18} />
          <span>Home</span>
        </Link>
        <Link to="/clubs" className="flex flex-col items-center gap-1 text-xs">
          <Users size={18} />
          <span>Clubs</span>
        </Link>
        <Link to="/movies" className="flex flex-col items-center gap-1 text-xs">
          <Film size={18} />
          <span>Movies</span>
        </Link>
        <Link to="/profile" className="flex flex-col items-center gap-1 text-xs">
          <UserIcon size={18} />
          <span>Profile</span>
        </Link>
      </div>
    </nav>
    </>
  );
}
