// src/pages/Clubs.jsx (redesigned: filter pill + carousel akin to Clubs2)
import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import supabase from "../supabaseClient.js";
import "../App.css";
import "./Clubs.css";
import { useUser } from "../context/UserContext";
import { Users, CalendarDays, Trophy, PlusCircle } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { Navigation, Mousewheel, Keyboard } from "swiper/modules";

/* ---------- Filter metadata ---------- */
const SIZES = ["Small (≤50)", "Medium (50–150)", "Large (150+)"];
const SIZE_KEY = ["small", "medium", "large"];
const LOCATIONS = [
  // Global cities / markets
  "London",
  "Mogadishu",
  "Warsaw",
  "New York City",
  "Los Angeles",
  "Paris",
  "Berlin",
  "Toronto",
  "Vancouver",
  "Chicago",
  "San Francisco",
  "Mexico City",
  "Sao Paulo",
  "Buenos Aires",
  "Madrid",
  "Barcelona",
  "Lisbon",
  "Rome",
  "Milan",
  "Copenhagen",
  "Stockholm",
  "Oslo",
  "Helsinki",
  "Dublin",
  "Amsterdam",
  "Brussels",
  "Zurich",
  "Geneva",
  "Vienna",
  "Prague",
  "Budapest",
  "Istanbul",
  "Dubai",
  "Abu Dhabi",
  "Riyadh",
  "Doha",
  "Cairo",
  "Nairobi",
  "Lagos",
  "Accra",
  "Johannesburg",
  "Cape Town",
  "Abuja",
  "Addis Ababa",
  "Kigali",
  "Kampala",
  "Tunis",
  "Algiers",
  "Rabat",
  "Dakar",
  "Pretoria",
  "Luanda",
  "Maputo",
  "Harare",
  "Mumbai",
  "Delhi",
  "Bengaluru",
  "Chennai",
  "Kolkata",
  "Dhaka",
  "Karachi",
  "Lahore",
  "Singapore",
  "Hong Kong",
  "Tokyo",
  "Osaka",
  "Seoul",
  "Taipei",
  "Beijing",
  "Shanghai",
  "Manila",
  "Jakarta",
  "Sydney",
  "Melbourne",
  "Auckland",
  "Wellington",
  // Broad regions fallback
  "North America",
  "Europe",
  "Asia",
  "South America",
  "Africa",
  "Oceania",
  "Online",
];
const GENRES = [
  "Drama",
  "Thriller",
  "Horror",
  "Comedy",
  "Sci-Fi",
  "Action",
  "Indie",
  "Documentary",
  "Romance",
  "Animation",
];

/* ---------- Cache + paging ---------- */
const CACHE_KEY = "sf.clubs2.cache.v2";
const CACHE_MAX_AGE = 1000 * 60 * 5; // 5 minutes
const PAGE_SIZE = 40;
const svgPlaceholder = (w, h, label) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#141414"/><text x="50%" y="50%" fill="#6b7280" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" dominant-baseline="central">${label}</text></svg>`
  )}`;
const CLUB_PLACEHOLDER = svgPlaceholder(300, 480, "Club");
const CLUB_EVENT_PLACEHOLDER = svgPlaceholder(300, 160, "Club");
const safeClubImage = (url, fallback = CLUB_PLACEHOLDER) => {
  if (!url || typeof url !== "string") return fallback;
  if (/^https?:\/\//i.test(url)) return url;
  return fallback;
};

function enrichClubs(list) {
  return (list || []).map((c) => {
    const baseMeta = c.meta && typeof c.meta === "object" ? c.meta : {};
    return { ...c, meta: { ...baseMeta } };
  });
}

/* ---------- Swiper config ---------- */
const swiperConfig = {
  modules: [Navigation, Mousewheel, Keyboard],
  slidesPerView: "auto",
  spaceBetween: 14,
  navigation: false,
  loop: true,
  grabCursor: true,
  simulateTouch: true,
  threshold: 5,
  mousewheel: { forceToAxis: true, releaseOnEdges: false, sensitivity: 0.6 },
  keyboard: { enabled: true, onlyInViewport: true },
};

/* ---------- Hover overlay ---------- */
function HoverPreview({ sourceEl, club, scale = 1.06, showTooltip = false, tooltipData }) {
  const ghostRef = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!sourceEl) return;
    let rafId;
    const follow = () => {
      if (!ghostRef.current || !sourceEl) return;
      const r = sourceEl.getBoundingClientRect();
      const g = ghostRef.current;
      g.style.top = `${r.top}px`;
      g.style.left = `${r.left}px`;
      g.style.width = `${r.width}px`;
      g.style.height = `${r.height}px`;
      rafId = requestAnimationFrame(follow);
    };
    follow();
    const startId = requestAnimationFrame(() => setActive(true));
    return () => {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(startId);
    };
  }, [sourceEl]);

  if (!sourceEl || !club) return null;
  const m = club.meta || {};

  return createPortal(
    <div
      ref={ghostRef}
      className={`preview-ghost ${active ? "active" : ""}`}
      style={{ "--scale": scale }}
      aria-hidden
    >
      <div className="preview-card">
        <div className="w-full bg-zinc-900/70 overflow-hidden club-media">
          <div className="club-thumb">
            <img
              src={safeClubImage(club.image)}
              alt={club.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = CLUB_PLACEHOLDER;
              }}
            />
          </div>
          <div className="club-badges">
            {m.isNew && (
              <span className="badge">
                <span className="badge-dot" />
                New
              </span>
            )}
            {m.activeThisWeek && (
              <span className="badge">
                <span className="badge-dot" />
                Active this week
              </span>
            )}
            {m.liveSoon && (
              <span className="badge">
                <span className="badge-dot" />
                Live soon
              </span>
            )}
          </div>
        </div>
        <div className="px-3 py-2 text-white text-sm font-semibold truncate">{club.name}</div>
      </div>

      <div className={`club-tooltip ${showTooltip ? "show" : ""}`}>
        <div className="club-tooltip__row">
          <span className="club-dot" /> <strong className="mr-1">Members:</strong>{" "}
          {tooltipData?.members ?? "—"}
        </div>
        <div className="club-tooltip__row">
          <span className="club-dot" /> <strong className="mr-1">Summary:</strong>{" "}
          {tooltipData?.summary ?? "—"}
        </div>
        <div className="club-tooltip__row">
          <span className="club-dot" /> <strong className="mr-1">Upcoming:</strong>{" "}
          {tooltipData?.upcoming ?? "—"}
        </div>
        <div className="club-tooltip__row">
          <span className="club-dot" /> <strong className="mr-1">Fav genres:</strong>{" "}
          {tooltipData?.fav ?? "—"}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ---------- Filters helpers ---------- */
const DEFAULT_FILTERS = {
  size: "any",
  location: "any",
  genres: [],
};

function passesFilters(meta, f) {
  if (f.size !== "any" && meta.size !== f.size) return false;
  if (f.location !== "any" && meta.location !== f.location) return false;
  if (f.genres.length > 0) {
    const evGenres = Array.isArray(meta.genres) ? meta.genres : [];
    const hasOverlap = evGenres.some((g) => f.genres.includes(g));
    if (!hasOverlap) return false;
  }
  return true;
}

/* Supabase row → UI club mapper */
function mapRowToClub(row) {
  const genreFocus = Array.isArray(row.genre_focus) ? row.genre_focus : undefined;
  const metaFromRow =
    row.meta && typeof row.meta === "object"
      ? { ...row.meta }
      : {
          size: row.size ?? undefined,
          location: row.location ?? undefined,
          genres: Array.isArray(row.genres) ? row.genres : genreFocus,
          members: typeof row.members === "number" ? row.members : undefined,
          isNew: typeof row.is_new === "boolean" ? row.is_new : undefined,
          activeThisWeek: typeof row.active_this_week === "boolean" ? row.active_this_week : undefined,
          liveSoon: typeof row.live_soon === "boolean" ? row.live_soon : undefined,
          summary: row.summary ?? undefined,
          tagline: row.tagline ?? undefined,
        };

  if (typeof row.is_official === "boolean") metaFromRow.is_official = row.is_official;
  if (typeof row.is_superfilm === "boolean") metaFromRow.is_superfilm = row.is_superfilm;
  if (typeof row.is_curated === "boolean") metaFromRow.is_curated = row.is_curated;
  if (typeof row.join_policy === "string") metaFromRow.join_policy = row.join_policy;
  if (typeof row.privacy_mode === "string" && !metaFromRow.join_policy) {
    metaFromRow.join_policy = row.privacy_mode;
  }
  if (typeof row.type === "string") metaFromRow.type = row.type;

  return {
    id: `db-${String(row.id)}`,
    slug: row.slug || null,
    path: row.slug || String(row.id),
    rawId: row.id,
    name: row.name ?? "Untitled Club",
    image:
      row.profile_image_url ??
      row.image_url ??
      row.image ??
      CLUB_PLACEHOLDER,
    meta: metaFromRow,
    createdAt: row.created_at ?? null,
  };
}

function formatEventDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function Clubs() {
  const navigate = useNavigate();
  const { profile } = useUser();
  const userClubId = profile?.club_id ?? profile?.current_club_id ?? null;
  const userHasClub = !!userClubId;

  const [hover, setHover] = useState(null);
  const [showTip, setShowTip] = useState(false);
  const [tipData, setTipData] = useState(null);
  const timerRef = useRef(null);
  const swiperRefs = useRef([]);

  const clearTipTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  const cancelHover = useCallback(() => {
    clearTipTimer();
    setShowTip(false);
    setHover(null);
  }, []);

  useEffect(() => {
    if (!hover) return;
    const onWheel = () => cancelHover();
    const onScroll = () => cancelHover();
    const onKey = (e) => {
      if (["ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", " "].includes(e.key))
        cancelHover();
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("keydown", onKey);

    const detach = [];
    swiperRefs.current.forEach((swiper) => {
      if (swiper && swiper.on && swiper.off) {
        const bind = (evt) => {
          const fn = () => cancelHover();
          swiper.on(evt, fn);
          detach.push(() => swiper.off(evt, fn));
        };
        ["touchStart", "sliderMove", "transitionStart", "slideChange"].forEach(bind);
      }
    });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("keydown", onKey);
      detach.forEach((fn) => fn && fn());
    };
  }, [hover, cancelHover]);

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [openFilter, setOpenFilter] = useState(null);
  const [search, setSearch] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const panelRef = useRef(null);

  const [liveClubs, setLiveClubs] = useState(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (parsed?.ts && Date.now() - parsed.ts < CACHE_MAX_AGE) {
        return Array.isArray(parsed.data) ? parsed.data : [];
      }
    } catch (_) {}
    return [];
  });
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [realtimeAttached, setRealtimeAttached] = useState(false);

  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [nextScreeningByClub, setNextScreeningByClub] = useState({});

  const saveCache = useCallback((list) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: list }));
    } catch (_) {}
  }, []);

  const mergeUnique = (prev, next) => {
    const seen = new Set();
    const combined = [...prev, ...next];
    return combined.filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  };

  const CLUB_SELECT = `*`;

  const fetchClubsPage = useCallback(
    async (pageIndex = 0, append = false) => {
      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      if (append) setLoadingMore(true);
      else setLoadingClubs(true);

      try {
        const { data, error } = await supabase.from("clubs").select(CLUB_SELECT).range(from, to);

        if (error) throw error;

        const mapped = (data || []).map(mapRowToClub);
        setHasMore((data || []).length === PAGE_SIZE);

        setLiveClubs((prev) => {
          const merged = append ? mergeUnique(prev, mapped) : mapped;
          saveCache(merged);
          return merged;
        });

        setPage(pageIndex);
      } catch (err) {
        console.error("⚠️ Clubs load failed:", err);
      } finally {
        setLoadingClubs(false);
        setLoadingMore(false);
        setInitialFetchDone(true);
      }
    },
    [saveCache]
  );

  useEffect(() => {
    if (liveClubs.length > 0) setLoadingClubs(false);
    fetchClubsPage(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchClubsPage]);

  useEffect(() => {
    if (!initialFetchDone || realtimeAttached) return;

    const channel = supabase
      .channel("clubs2-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "clubs" }, (payload) => {
        setLiveClubs((prev) => {
          const c = mapRowToClub(payload.new);
          if (prev.some((x) => x.id === c.id)) return prev;
          const merged = [c, ...prev].slice(0, 200);
          saveCache(merged);
          return merged;
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "clubs" }, (payload) => {
        setLiveClubs((prev) => {
          const c = mapRowToClub(payload.new);
          const merged = prev.map((x) => (x.id === c.id ? c : x));
          saveCache(merged);
          return merged;
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "clubs" }, (payload) => {
        setLiveClubs((prev) => {
          const id = `db-${String(payload.old.id)}`;
          const merged = prev.filter((x) => x.id !== id);
          saveCache(merged);
          return merged;
        });
      })
      .subscribe();

    setRealtimeAttached(true);
    return () => supabase.removeChannel(channel);
  }, [initialFetchDone, realtimeAttached, saveCache]);

  useEffect(() => {
    if (loadingClubs) return;
    let mounted = true;

    (async () => {
      try {
        const now = new Date();
        const in30 = new Date();
        in30.setDate(now.getDate() + 30);

        const { data, error } = await supabase
          .from("screenings")
          .select("*")
          .gte("starts_at", now.toISOString())
          .lte("starts_at", in30.toISOString())
          .order("starts_at", { ascending: true })
          .limit(20);

        if (error) throw error;

        const joined = (data || [])
          .map((ev) => {
            const club = liveClubs.find((c) => c.rawId === ev.club_id);
            if (!club) return null;

            const title = ev.title || ev.name || ev.film_title || "Club event";

            return {
              id: ev.id,
              title,
              starts_at: ev.starts_at,
              clubId: club.id,
              clubRawId: club.rawId,
              clubName: club.name,
              clubImage: safeClubImage(club.image, CLUB_EVENT_PLACEHOLDER),
            };
          })
          .filter(Boolean);

        if (mounted) {
          setUpcomingEvents(joined);
          setLoadingEvents(false);
        }
      } catch (e) {
        console.error("⚠️ Upcoming events fetch crashed:", e);
        if (mounted) {
          setUpcomingEvents([]);
          setLoadingEvents(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadingClubs, liveClubs]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ids = (liveClubs || [])
        .map((c) => c.rawId)
        .filter(Boolean);
      if (!ids.length) {
        if (mounted) setNextScreeningByClub({});
        return;
      }

      try {
        const { data, error } = await supabase
          .from("club_next_screening_v")
          .select("club_id, film_title, screening_at, location")
          .in("club_id", ids);
        if (error) throw error;

        const map = {};
        (data || []).forEach((row) => {
          if (!row?.club_id) return;
          map[row.club_id] = row;
        });
        if (mounted) setNextScreeningByClub(map);
      } catch (e) {
        if (mounted) setNextScreeningByClub({});
      }
    })();
    return () => {
      mounted = false;
    };
  }, [liveClubs]);

  const getTooltipData = useCallback(
    (club) => {
      const m = club.meta || {};
      const firstEvent = upcomingEvents.find((ev) => ev.clubId === club.id);
      const nextRow = nextScreeningByClub[club.rawId];
      const upcoming =
        nextRow?.screening_at
          ? `${nextRow.film_title || "Screening"} — ${formatEventDateTime(nextRow.screening_at)}`
          : firstEvent
          ? `${firstEvent.title} — ${formatEventDateTime(firstEvent.starts_at)}`
          : "No upcoming events scheduled.";

      return {
        members: m.members ?? null,
        summary: m.summary || m.tagline || null,
        upcoming,
        fav: Array.isArray(m.genres) && m.genres.length ? m.genres.join(", ") : null,
      };
    },
    [upcomingEvents, nextScreeningByClub]
  );

  const handleEnter = useCallback(
    (e, club, idx) => {
      setHover({ el: e.currentTarget, club, idx });
      setShowTip(false);
      clearTipTimer();
      setTipData(getTooltipData(club));
      timerRef.current = setTimeout(() => setShowTip(true), 1000);
    },
    [getTooltipData]
  );

  const handleLeave = useCallback(() => cancelHover(), [cancelHover]);

  const combined = enrichClubs(liveClubs);
  const isOfficialClub = useCallback((club) => {
    const m = club?.meta || {};
    return m.type === "superfilm_curated";
  }, []);

  const activeCount =
    (filters.size !== "any") + (filters.location !== "any") + (filters.genres.length > 0 ? 1 : 0);

  const matchesSearch = useCallback(
    (club) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const m = club.meta || {};
      return (
        club.name.toLowerCase().includes(q) ||
        (m.location && m.location.toLowerCase().includes(q)) ||
        (Array.isArray(m.genres) && m.genres.some((g) => g.toLowerCase().includes(q)))
      );
    },
    [search]
  );

  const filteredByFilters = combined.filter((c) => passesFilters(c.meta || {}, filters));
  const filtered = filteredByFilters.filter(matchesSearch);

  const curatedClubs = combined.filter(isOfficialClub);
  const communityClubs = combined.filter((c) => !isOfficialClub(c));
  const filteredCurated = curatedClubs.filter((c) => filtered.includes(c));
  const filteredCommunity = communityClubs.filter((c) => filtered.includes(c));

  const baseCurated = filteredCurated.length > 0 ? filteredCurated : curatedClubs;
  const baseForCarousel = filteredCommunity.length > 0 ? filteredCommunity : communityClubs;
  const noMatches = !loadingClubs && combined.length > 0 && filtered.length === 0;

  useEffect(() => {
    if (!openFilter) return;
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpenFilter(null);
      }
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setOpenFilter(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [openFilter]);

  const update = (key, value) =>
    setFilters((f) => ({
      ...f,
      [key]: value,
    }));

  const toggleGenre = (g) =>
    setFilters((f) => {
      const has = f.genres.includes(g);
      return {
        ...f,
        genres: has ? f.genres.filter((x) => x !== g) : [...f.genres, g],
      };
    });

  const clearAll = () => setFilters(DEFAULT_FILTERS);

  const clearCurrentFilter = () => {
    setFilters((f) => {
      if (openFilter === "size") return { ...f, size: "any" };
      if (openFilter === "location") return { ...f, location: "any" };
      if (openFilter === "genre") return { ...f, genres: [] };
      return f;
    });
  };

  const sizeLabel = (() => {
    if (filters.size === "small") return SIZES[0];
    if (filters.size === "medium") return SIZES[1];
    if (filters.size === "large") return SIZES[2];
    return "Any size";
  })();

  const locationLabel = filters.location === "any" ? "Anywhere" : filters.location;

  const genreLabel =
    filters.genres.length === 0
      ? "Any genre"
      : filters.genres.length === 1
      ? filters.genres[0]
      : `${filters.genres[0]} +${filters.genres.length - 1}`;

  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);

  return (
    <div className="clubs2 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] min-h-screen">
      <main className="relative max-w-7xl mx-auto px-3 pt-6 pb-8 sm:px-6 sm:pt-8 sm:pb-10">
        <header className="mb-6 sm:mb-8 flex flex-col gap-2 sm:gap-3">
          <div>
            <p className="text-[0.6rem] tracking-[0.32em] uppercase text-zinc-500">Clubs</p>
            <h1 className="mt-1 sm:mt-2 text-2xl sm:text-4xl font-semibold text-[rgb(var(--brand-yellow))]">
              Discover film communities
            </h1>
          </div>
          <p className="max-w-3xl text-[13px] sm:text-sm text-zinc-400">
            {loadingClubs
              ? "Loading clubs…"
              : "Join clubs that match your taste in films, genres and watch habits."}
          </p>
        </header>

        <section className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1 w-full flex justify-center sm:justify-start">
              <div className="clubs-filter-shell" ref={panelRef}>
                <div className="clubs-filter-pill">
                  <div className="clubs-filter-segment clubs-filter-search">
                    <div className="clubs-filter-label">Search clubs</div>
                    <input
                      className="clubs-search-input"
                      placeholder="Titles, locations, genres…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>

                  <button
                    type="button"
                    className={`clubs-filter-segment clubs-filter-button ${
                      openFilter === "size" ? "is-active" : ""
                    }`}
                    onClick={() => setOpenFilter((cur) => (cur === "size" ? null : "size"))}
                  >
                    <div className="clubs-filter-label">Size</div>
                    <div className="clubs-filter-value">{sizeLabel}</div>
                  </button>

                  <button
                    type="button"
                    className={`clubs-filter-segment clubs-filter-button ${
                      openFilter === "location" ? "is-active" : ""
                    }`}
                    onClick={() =>
                      setOpenFilter((cur) => (cur === "location" ? null : "location"))
                    }
                  >
                    <div className="clubs-filter-label">Location</div>
                    <div className="clubs-filter-value">{locationLabel}</div>
                  </button>

                  <button
                    type="button"
                    className={`clubs-filter-segment clubs-filter-button ${
                      openFilter === "genre" ? "is-active" : ""
                    }`}
                    onClick={() => setOpenFilter((cur) => (cur === "genre" ? null : "genre"))}
                  >
                    <div className="clubs-filter-label">Favourite genre</div>
                    <div className="clubs-filter-value">{genreLabel}</div>
                  </button>
                </div>

                {activeCount > 0 && (
                  <div className="clubs-filter-count-pill">
                    {activeCount} filter{activeCount > 1 ? "s" : ""} active
                  </div>
                )}

                {openFilter && (
                  <div className="clubs-filter-popover" role="dialog">
                    <div className="clubs-filter-popover-card">
                      {openFilter === "size" && (
                        <>
                          <div className="popover-title">Club size</div>
                          <div className="popover-subtitle">
                            Choose how big you want your club to be.
                          </div>
                          <div className="popover-options">
                            {SIZES.map((label, idx) => {
                              const key = SIZE_KEY[idx];
                              const on = filters.size === key;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  className={`popover-chip ${on ? "on" : ""}`}
                                  onClick={() => update("size", key)}
                                >
                                  {label}
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              className={`popover-chip ${filters.size === "any" ? "on" : ""}`}
                              onClick={() => update("size", "any")}
                            >
                              Any size
                            </button>
                          </div>
                        </>
                      )}

                      {openFilter === "location" && (
                        <>
                          <div className="popover-title">Location</div>
                          <div className="popover-subtitle">
                            Explore clubs from anywhere or focus on a region.
                          </div>
                          <div className="popover-options">
                            <button
                              type="button"
                              className={`popover-chip ${
                                filters.location === "any" ? "on" : ""
                              }`}
                              onClick={() => update("location", "any")}
                            >
                              Anywhere
                            </button>
                            {LOCATIONS.map((loc) => (
                              <button
                                key={loc}
                                type="button"
                                className={`popover-chip ${
                                  filters.location === loc ? "on" : ""
                                }`}
                                onClick={() => update("location", loc)}
                              >
                                {loc}
                              </button>
                            ))}
                          </div>
                          <div className="mt-3 flex gap-2 items-center">
                            <input
                              type="text"
                              className="flex-1 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                              placeholder="Search or add another city"
                              value={locationInput}
                              onChange={(e) => setLocationInput(e.target.value)}
                            />
                            <button
                              type="button"
                              className="btn primary sm"
                              onClick={() => {
                                const val = locationInput.trim();
                                if (val) {
                                  update("location", val);
                                  setLocationInput(val);
                                }
                              }}
                            >
                              Use
                            </button>
                          </div>
                        </>
                      )}

                      {openFilter === "genre" && (
                        <>
                          <div className="popover-title">Favourite genre</div>
                          <div className="popover-subtitle">
                            Pick the kinds of films you want the club to love.
                          </div>
                          <div className="popover-options popover-options-wrap">
                            {GENRES.map((g) => {
                              const on = filters.genres.includes(g);
                              return (
                                <button
                                  key={g}
                                  type="button"
                                  className={`popover-chip ${on ? "on" : ""}`}
                                  onClick={() => toggleGenre(g)}
                                >
                                  {g}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}

                      <div className="popover-footer">
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={clearCurrentFilter}
                        >
                          Clear
                        </button>
                        <div className="popover-footer-right">
                          <button type="button" className="btn ghost sm" onClick={clearAll}>
                            Reset all
                          </button>
                          <button
                            type="button"
                            className="btn primary sm"
                            onClick={() => setOpenFilter(null)}
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="clubs-quick-actions">
              <div className="mobile-actions-trigger">
                <button
                  type="button"
                  className="nav-pill w-full justify-center"
                  onClick={() => setMobileActionsOpen((v) => !v)}
                >
                  <Users className="nav-pill-icon" />
                  <span>Actions</span>
                </button>
                {mobileActionsOpen && (
                  <div className="mobile-actions-menu">
                    <button className="nav-pill" onClick={() => navigate("/myclub")}>
                      <Users className="nav-pill-icon" />
                      <span>My Club</span>
                    </button>
                    <button className="nav-pill" onClick={() => navigate("/events")}>
                      <CalendarDays className="nav-pill-icon" />
                      <span>Events</span>
                    </button>
                    <button className="nav-pill" onClick={() => navigate("/leaderboard")}>
                      <Trophy className="nav-pill-icon" />
                      <span>Leaderboard</span>
                    </button>
                    {!userHasClub && (
                      <button className="nav-pill nav-pill-accent" onClick={() => navigate("/create-club")}>
                        <PlusCircle className="nav-pill-icon" />
                        <span>Create club</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="desktop-actions">
                <button className="nav-pill" onClick={() => navigate("/myclub")}>
                  <Users className="nav-pill-icon" />
                  <span>My Club</span>
                </button>
                <button className="nav-pill" onClick={() => navigate("/events")}>
                  <CalendarDays className="nav-pill-icon" />
                  <span>Events</span>
                </button>
                <button className="nav-pill" onClick={() => navigate("/leaderboard")}>
                  <Trophy className="nav-pill-icon" />
                  <span>Leaderboard</span>
                </button>
                {!userHasClub && (
                  <button className="nav-pill nav-pill-accent" onClick={() => navigate("/create-club")}>
                    <PlusCircle className="nav-pill-icon" />
                    <span>Create club</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-10">
          {!loadingClubs && combined.length === 0 && (
            <div className="mb-4 text-sm text-zinc-400">No clubs yet. Create the first one!</div>
          )}
          {noMatches && (
            <div className="mb-4 text-sm text-zinc-400">
              No clubs match your search/filters. Showing all clubs instead.
            </div>
          )}

          {baseCurated.length > 0 && (
            <div className="mb-8">
              <div className="mb-3">
                <h3 className="text-xl font-semibold text-[rgb(var(--brand-yellow))]">
                  SuperFilm Clubs
                </h3>
                <p className="text-sm text-zinc-400">
                  Hand-picked clubs for instant movie community.{" "}
                  <span className="text-zinc-500">Everyone can join — no requests needed.</span>
                </p>
              </div>
              <Swiper {...swiperConfig} onSwiper={(s) => (swiperRefs.current[0] = s)} className="!w-full">
                {(baseCurated.length > 4 ? [...baseCurated, ...baseCurated] : baseCurated).map(
                  (club, index) => {
                    const m = club.meta || {};
                    return (
                      <SwiperSlide key={`curated-${club.id}-${index}`} className="!w-[210px]">
                        <Link
                          to={`/clubs/${club.path || club.slug || club.rawId || club.id}`}
                          className="club-card group block"
                          onMouseEnter={(e) => handleEnter(e, club, index)}
                          onMouseLeave={handleLeave}
                        >
                          <div className="club-thumb">
                            <img
                              src={safeClubImage(club.image)}
                              alt={club.name}
                              loading="lazy"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = CLUB_PLACEHOLDER;
                              }}
                            />
                            <div className="club-badges">
                              <span className="badge">
                                <span className="badge-dot" />
                                Official
                              </span>
                            </div>
                          </div>
                          <div className="p-3">
                            <div className="text-sm font-semibold text-white truncate">{club.name}</div>
                            {Array.isArray(m.genres) && m.genres.length > 0 && (
                              <div className="mt-1 text-[0.7rem] uppercase tracking-wide text-zinc-400 truncate">
                                {m.genres.join(" • ")}
                              </div>
                            )}
                          </div>
                        </Link>
                      </SwiperSlide>
                    );
                  }
                )}
              </Swiper>
            </div>
          )}

          {baseForCarousel.length > 0 && (
            <>
              <div className="mb-3">
                <h3 className="text-xl font-semibold text-[rgb(var(--brand-yellow))]">
                  Member-Created Clubs
                </h3>
                <p className="text-sm text-zinc-400">
                  Clubs made by the community, for the community.
                </p>
              </div>
              <Swiper {...swiperConfig} onSwiper={(s) => (swiperRefs.current[1] = s)} className="!w-full">
                {(baseForCarousel.length > 4
                  ? [...baseForCarousel, ...baseForCarousel]
                  : baseForCarousel
                ).map((club, index) => {
                  const m = club.meta || {};
                  return (
                    <SwiperSlide key={`popular-${club.id}-${index}`} className="!w-[210px]">
                      <Link
                        to={`/clubs/${club.path || club.slug || club.rawId || club.id}`}
                        className="club-card group block"
                        onMouseEnter={(e) => handleEnter(e, club, index)}
                        onMouseLeave={handleLeave}
                      >
                        <div className="club-thumb">
            <img
              src={safeClubImage(club.image)}
              alt={club.name}
              loading="lazy"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = CLUB_PLACEHOLDER;
              }}
            />
                          <div className="club-badges">
                            {m.isNew && (
                              <span className="badge">
                                <span className="badge-dot" />
                                New
                              </span>
                            )}
                            {m.activeThisWeek && (
                              <span className="badge">
                                <span className="badge-dot" />
                                Active this week
                              </span>
                            )}
                            {m.liveSoon && (
                              <span className="badge">
                                <span className="badge-dot" />
                                Live soon
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="p-3">
                          <div className="text-sm font-semibold text-white truncate">{club.name}</div>
                          {Array.isArray(m.genres) && m.genres.length > 0 && (
                            <div className="mt-1 text-[0.7rem] uppercase tracking-wide text-zinc-400 truncate">
                              {m.genres.join(" • ")}
                            </div>
                          )}
                        </div>
                      </Link>
                    </SwiperSlide>
                  );
                })}
              </Swiper>

            </>
          )}
        </section>

        <section className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-semibold text-[rgb(var(--brand-yellow))]">Happening soon</h3>
            <Link to="/events" className="text-sm text-zinc-400 hover:text-zinc-200">
              See all
            </Link>
          </div>

          {loadingEvents ? (
            <p className="text-sm text-zinc-400">Loading upcoming events…</p>
          ) : !upcomingEvents.length ? (
            <p className="text-sm text-zinc-500">Events taking place soon will show up here.</p>
          ) : (
            <div className="events-grid">
              {upcomingEvents.slice(0, 6).map((ev) => (
                <Link key={`soon-${ev.id}`} to={`/events/${ev.id}`} className="event-card">
                  <div className="event-thumb">
                    <img
                      src={safeClubImage(ev.clubImage, CLUB_EVENT_PLACEHOLDER)}
                      alt={ev.clubName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = CLUB_EVENT_PLACEHOLDER;
                      }}
                    />
                  </div>

                  <div className="event-info">
                    <div className="event-title">{ev.title}</div>
                    <div className="event-sub">
                      <span className="event-dot" /> {ev.clubName} • {formatEventDateTime(ev.starts_at)}
                    </div>
                  </div>

                  <div className="event-go" aria-label="Go to event">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                      <path
                        d="M8 5l8 7-8 7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="pb-14">
          <Link
            to="/events"
            className="group block rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/40 shadow-xl relative transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,215,0,0.35)] hover:border-[rgb(var(--brand-yellow))]/60"
          >
            <div className="relative h-72 md:h-[24rem] lg:h-[28rem] overflow-hidden">
              <img
                src="https://image.tmdb.org/t/p/original/fUnrwL6B0yohfhaXqt5OWHMsjmd.jpg"
                alt="Explore upcoming events"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent" />

              <div className="absolute bottom-4 left-5 md:left-7">
                <p className="text-sm uppercase tracking-widest text-zinc-400">SuperFilm Events</p>
                <h3 className="mt-1 text-2xl md:text-3xl font-semibold text-[rgb(var(--brand-yellow))] drop-shadow-lg">
                  Discover all upcoming events
                </h3>
                <p className="mt-2 text-sm text-zinc-300">Click to explore every scheduled club event.</p>
              </div>
            </div>
          </Link>
        </section>
      </main>

      {hover?.el && (
        <HoverPreview
          sourceEl={hover.el}
          club={hover.club}
          scale={1.06}
          showTooltip={showTip}
          tooltipData={tipData}
        />
      )}
    </div>
  );
}
