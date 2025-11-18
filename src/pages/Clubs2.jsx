// src/pages/Clubs2.jsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/navigation';
import { Navigation, Mousewheel, Keyboard } from 'swiper/modules';

import supabase from '../supabaseClient.js';
import '../App.css';
import './Clubs2.css';
import { useUser } from "../context/UserContext";


/* ---------- Filter metadata ---------- */
const SIZES = ['Small (≤50)', 'Medium (50–150)', 'Large (150+)'];
const SIZE_KEY = ['small', 'medium', 'large'];
const LOCATIONS = ['North America', 'Europe', 'Asia', 'South America', 'Africa', 'Oceania', 'Online'];
const ACTIVITY = ['Chill', 'Active', 'Very Active'];
const MEETING = ['Weeknights', 'Weekends', 'Late Night'];
const FORMAT = ['Online', 'In-person', 'Hybrid'];
const LANGS = ['English', 'Spanish', 'French', 'German', 'Polish'];
const GENRES = ['Drama', 'Thriller', 'Horror', 'Comedy', 'Sci-Fi', 'Action', 'Indie', 'Documentary', 'Romance', 'Animation'];

/* If a club has meta, just normalise it; no fake defaults */
function enrichClubs(list) {
  return list.map((c) => {
    const baseMeta = c.meta && typeof c.meta === 'object' ? c.meta : {};
    return {
      ...c,
      meta: {
        ...baseMeta,
      },
    };
  });
}

/* ---------- Swiper config ---------- */
const swiperConfig = {
  modules: [Navigation, Mousewheel, Keyboard],
  slidesPerView: 'auto',
  spaceBetween: 16,
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
    return () => { cancelAnimationFrame(rafId); cancelAnimationFrame(startId); };
  }, [sourceEl]);

  if (!sourceEl || !club) return null;
  const m = club.meta || {};

  return createPortal(
    <div
      ref={ghostRef}
      className={`preview-ghost ${active ? 'active' : ''}`}
      style={{ '--scale': scale }}
      aria-hidden
    >
      <div className="preview-card">
        <div className="w-full h-[14rem] bg-zinc-700 overflow-hidden club-media">
          <img
            src={club.image}
            alt={club.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/300x160?text=Coming+Soon'; }}
          />
          <div className="club-badges">
            {m.isNew && (
              <span className="badge">
                <span className="badge-dot" />New
              </span>
            )}
            {m.activeThisWeek && (
              <span className="badge">
                <span className="badge-dot" />Active this week
              </span>
            )}
            {m.liveSoon && (
              <span className="badge">
                <span className="badge-dot" />Live soon
              </span>
            )}
          </div>
        </div>
        <div className="p-3 text-white text-lg font-semibold">{club.name}</div>
      </div>

      <div className={`club-tooltip ${showTooltip ? 'show' : ''}`}>
        <div className="club-tooltip__row">
          <span className="club-dot" /> <strong className="mr-1">Members:</strong>{' '}
          {tooltipData?.members ?? '—'}
        </div>
        <div className="club-tooltip__row">
          <span className="club-dot" /> <strong className="mr-1">Summary:</strong>{' '}
          {tooltipData?.summary ?? '—'}
        </div>
        <div className="club-tooltip__row">
          <span className="club-dot" /> <strong className="mr-1">Upcoming:</strong>{' '}
          {tooltipData?.upcoming ?? '—'}
        </div>
        <div className="club-tooltip__row">
          <span className="club-dot" /> <strong className="mr-1">Fav genres:</strong>{' '}
          {tooltipData?.fav ?? '—'}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ---------- Filters helpers ---------- */
const DEFAULT_FILTERS = {
  size: 'any',
  location: 'any',
  activity: 'any',
  meeting: 'any',
  format: 'any',
  language: 'any',
  open: 'any',
  genres: [],
};

function passesFilters(meta, f) {
  if (f.size !== 'any' && meta.size !== f.size) return false;
  if (f.location !== 'any' && meta.location !== f.location) return false;
  if (f.activity !== 'any' && meta.activity !== f.activity) return false;
  if (f.meeting !== 'any' && meta.meeting !== f.meeting) return false;
  if (f.format !== 'any' && meta.format !== f.format) return false;
  if (f.language !== 'any' && meta.language !== f.language) return false;
  if (f.open !== 'any') {
    const wantOpen = f.open === 'open';
    if (meta.open !== wantOpen) return false;
  }
  if (f.genres.length > 0 && !meta.genres?.some((g) => f.genres.includes(g))) return false;
  return true;
}

/* Supabase row → UI club mapper (keep rawId for joins) */
function mapRowToClub(row) {
  const metaFromRow =
    row.meta && typeof row.meta === 'object'
      ? row.meta
      : {
          size: row.size ?? undefined,
          location: row.location ?? undefined,
          activity: row.activity ?? undefined,
          meeting: row.meeting ?? undefined,
          format: row.format ?? undefined,
          language: row.language ?? undefined,
          open: typeof row.open === 'boolean' ? row.open : undefined,
          genres: Array.isArray(row.genres) ? row.genres : undefined,
          members: typeof row.members === 'number' ? row.members : undefined,
          isNew: typeof row.is_new === 'boolean' ? row.is_new : undefined,
          activeThisWeek:
            typeof row.active_this_week === 'boolean'
              ? row.active_this_week
              : undefined,
          liveSoon:
            typeof row.live_soon === 'boolean' ? row.live_soon : undefined,
        };

  return {
    id: `db-${String(row.id)}`,
    rawId: row.id,
    name: row.name ?? 'Untitled Club',

    // 👇 FIXED HERE — USES YOUR REAL COLUMN
    image:
      row.profile_image_url ??
      row.image_url ??
      row.image ??
      'https://via.placeholder.com/300x160?text=Club',

    meta: metaFromRow,
  };
}

/* ---------- Date formatting for events ---------- */
function formatEventDateTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/* ---------- Page ---------- */
export default function Clubs2() {
  /* Hover + tooltip */
  const [hover, setHover] = useState(null); // { el, club, idx }
  const [showTip, setShowTip] = useState(false);
  const [tipData, setTipData] = useState(null);
  const timerRef = useRef(null);
  const swiperRef = useRef(null);

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
      if (
        ['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(
          e.key
        )
      )
        cancelHover();
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onKey);

    const swiper = swiperRef.current;
    const detach = [];
    if (swiper && swiper.on && swiper.off) {
      const bind = (evt) => {
        const fn = () => cancelHover();
        swiper.on(evt, fn);
        detach.push(() => swiper.off(evt, fn));
      };
      ['touchStart', 'sliderMove', 'transitionStart', 'slideChange'].forEach(bind);
    }
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onKey);
      detach.forEach((fn) => fn && fn());
    };
  }, [hover, cancelHover]);

  /* Filters & search */
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [openFilters, setOpenFilters] = useState(false);
  const [search, setSearch] = useState('');
  const panelRef = useRef(null);

  /* Live clubs from Supabase */
  const [liveClubs, setLiveClubs] = useState([]);
  const [loadingClubs, setLoadingClubs] = useState(true);

  /* Upcoming events (real data) */
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const { profile } = useUser();
const userHasClub = !!profile?.club_id;


  // Load clubs on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        console.log('🔍 Fetching clubs from Supabase...');
        const { data, error } = await supabase.from('clubs').select('*').limit(200);
        if (error) {
          console.error('❌ Supabase fetch error:', error);
          throw error;
        }
        console.log('✅ Clubs fetched:', data);
        if (mounted) setLiveClubs((data || []).map(mapRowToClub));
      } catch (err) {
        console.error('⚠️ Clubs load failed:', err);
        if (mounted) setLiveClubs([]);
      } finally {
        if (mounted) setLoadingClubs(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Realtime club updates
  useEffect(() => {
    const channel = supabase
      .channel('clubs-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clubs' },
        (payload) => {
          setLiveClubs((prev) => {
            if (payload.eventType === 'INSERT') {
              const c = mapRowToClub(payload.new);
              if (prev.some((x) => x.id === c.id)) return prev;
              return [c, ...prev];
            }
            if (payload.eventType === 'UPDATE') {
              const c = mapRowToClub(payload.new);
              return prev.map((x) => (x.id === c.id ? c : x));
            }
            if (payload.eventType === 'DELETE') {
              const id = `db-${String(payload.old.id)}`;
              return prev.filter((x) => x.id !== id);
            }
            return prev;
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  /* Fetch upcoming events from screenings (real data only) */
  useEffect(() => {
    if (loadingClubs) return; // wait until clubs loaded

    let mounted = true;

    (async () => {
      try {
        const now = new Date();
        const in30 = new Date();
        in30.setDate(now.getDate() + 30);

        const { data, error } = await supabase
          .from('screenings')
          .select('*')
          .gte('starts_at', now.toISOString())
          .lte('starts_at', in30.toISOString())
          .order('starts_at', { ascending: true })
          .limit(20);

        if (error) {
          console.error('⚠️ Upcoming screenings load failed:', error);
          if (mounted) {
            setUpcomingEvents([]);
            setLoadingEvents(false);
          }
          return;
        }

        const joined = (data || [])
          .map((ev) => {
            const club = liveClubs.find((c) => c.rawId === ev.club_id);
            if (!club) return null;

            const title =
              ev.title || ev.name || ev.film_title || 'Club screening';

            return {
              id: ev.id,
              title,
              starts_at: ev.starts_at,
              clubId: club.id,
              clubRawId: club.rawId,
              clubName: club.name,
              clubImage: club.image,
            };
          })
          .filter(Boolean);

        if (mounted) {
          setUpcomingEvents(joined);
          setLoadingEvents(false);
        }
      } catch (e) {
        console.error('⚠️ Upcoming events fetch crashed:', e);
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

  /* Tooltip data derived from live meta + events */
  const getTooltipData = useCallback(
    (club) => {
      const m = club.meta || {};
      const firstEvent = upcomingEvents.find((ev) => ev.clubId === club.id);

      return {
        members: m.members ?? null,
        summary: m.summary || m.tagline || null,
        upcoming: firstEvent
          ? `${firstEvent.title} — ${formatEventDateTime(firstEvent.starts_at)}`
          : 'No upcoming events scheduled.',
        fav:
          Array.isArray(m.genres) && m.genres.length
            ? m.genres.join(', ')
            : null,
      };
    },
    [upcomingEvents]
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

  /* Combine: live clubs only, then enrich */
  const combined = enrichClubs(liveClubs);

  const activeCount =
    (filters.size !== 'any') +
    (filters.location !== 'any') +
    (filters.activity !== 'any') +
    (filters.meeting !== 'any') +
    (filters.format !== 'any') +
    (filters.language !== 'any') +
    (filters.open !== 'any') +
    (filters.genres.length > 0 ? 1 : 0);

  const matchesSearch = (club) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const m = club.meta || {};
    return (
      club.name.toLowerCase().includes(q) ||
      (m.location && m.location.toLowerCase().includes(q)) ||
      (m.language && m.language.toLowerCase().includes(q)) ||
      (Array.isArray(m.genres) &&
        m.genres.some((g) => g.toLowerCase().includes(q)))
    );
  };

  const filteredByFilters = combined.filter((c) => passesFilters(c.meta || {}, filters));
  const filtered = filteredByFilters.filter(matchesSearch);

  const baseForCarousel = filtered.length > 0 ? filtered : combined;

  // Close filters on outside click / Esc
  useEffect(() => {
    if (!openFilters) return;
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpenFilters(false);
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpenFilters(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [openFilters]);

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

  return (
    <div
      className="clubs2 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]
                 xl:grid xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-6
                 h-[calc(100vh-88px)] overflow-hidden"
    >
      {/* Sidebar */}
      <aside className="hidden xl:block w-64 h-full overflow-y-auto pt-8 pb-8 space-y-4 text-sm text-zinc-300 px-0">
        {/* Editor's Pick box */}
        <div className="mx-4 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl px-4 pt-6 pb-6">
          <h3 className="text-lg font-semibold mb-3 text-[rgb(var(--brand-yellow))]">
            Editor&apos;s Pick
          </h3>

          <button
            type="button"
            className="pick-card mb-4"
            onClick={() => {
              console.log('Go to Cinema Club');
            }}
          >
            <p className="text-white font-medium">Cinema Club</p>
            <p className="text-xs mt-1 text-zinc-400">
              New short film collab this week.
            </p>
          </button>

          <button
            type="button"
            className="pick-card"
            onClick={() => {
              console.log("Go to Critic's Choice");
            }}
          >
            <p className="text-white font-medium">Critic&apos;s Choice</p>
            <p className="text-xs mt-1 text-zinc-400">
              A24 Fans Group Meeting Soon
            </p>
          </button>
        </div>

        {/* Explore box */}
        <div className="mx-4 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl px-4 pt-6 pb-6">
          <h3 className="text-lg font-semibold mb-3 text-[rgb(var(--brand-yellow))]">
            Explore
          </h3>
          <ul className="space-y-2">
            <li>
              <Link to="/events" className="text-white hover:text-zinc-300">
                Events
              </Link>
            </li>
            <li>
              <Link to="/myclub" className="text-white hover:text-zinc-300">
                My Club
              </Link>
            </li>
            {/* Only show Create Club if user has no club */}
{!userHasClub && (
  <li>
    <Link to="/create-club" className="text-white hover:text-zinc-300">
      Create Club
    </Link>
  </li>
)}
            <li>
              <Link to="/leaderboard" className="text-white hover:text-zinc-300">
                Leaderboard
              </Link>
            </li>
          </ul>
        </div>
      </aside>

      {/* Main */}
      <main className="relative flex-1 min-w-0 h-full overflow-y-auto pr-6 pt-8">
        <div className="flex items-end justify-between mb-4 pr-2">
          <div>
            <h2 className="text-3xl font-bold mb-1 text-[rgb(var(--brand-yellow))]">
              Popular
            </h2>
            <p className="text-sm text-zinc-400">
              {loadingClubs ? 'Loading clubs…' : 'Scroll to explore more'}
            </p>
          </div>

          {/* Search + Filters */}
          <div className="relative flex items-center gap-3" ref={panelRef}>
            <input
              className="search"
              style={{ minWidth: 260 }}
              placeholder="Search clubs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button
              className={`filters-btn ${openFilters ? 'is-open' : ''} ${
                activeCount ? 'has-active' : ''
              }`}
              onClick={() => setOpenFilters((v) => !v)}
              aria-expanded={openFilters}
              aria-haspopup="menu"
            >
              <span>Filters</span>
              {activeCount > 0 && (
                <span className="filters-badge">{activeCount}</span>
              )}
              <svg
                className="filters-caret"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {openFilters && (
              <div className="filters-panel" role="menu">
                <div className="filters-grid">
                  {/* Size */}
                  <div>
                    <div className="filters-label">Club size</div>
                    <select
                      className="filters-select"
                      value={filters.size}
                      onChange={(e) => update('size', e.target.value)}
                    >
                      <option value="any">Any</option>
                      <option value="small">{SIZES[0]}</option>
                      <option value="medium">{SIZES[1]}</option>
                      <option value="large">{SIZES[2]}</option>
                    </select>
                  </div>

                  {/* Location */}
                  <div>
                    <div className="filters-label">Location</div>
                    <select
                      className="filters-select"
                      value={filters.location}
                      onChange={(e) => update('location', e.target.value)}
                    >
                      <option value="any">Any</option>
                      {LOCATIONS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Activity */}
                  <div>
                    <div className="filters-label">How active</div>
                    <select
                      className="filters-select"
                      value={filters.activity}
                      onChange={(e) => update('activity', e.target.value)}
                    >
                      <option value="any">Any</option>
                      {ACTIVITY.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Meeting time */}
                  <div>
                    <div className="filters-label">Meeting time</div>
                    <select
                      className="filters-select"
                      value={filters.meeting}
                      onChange={(e) => update('meeting', e.target.value)}
                    >
                      <option value="any">Any</option>
                      {MEETING.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Format */}
                  <div>
                    <div className="filters-label">Format</div>
                    <select
                      className="filters-select"
                      value={filters.format}
                      onChange={(e) => update('format', e.target.value)}
                    >
                      <option value="any">Any</option>
                      {FORMAT.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Language */}
                  <div>
                    <div className="filters-label">Language</div>
                    <select
                      className="filters-select"
                      value={filters.language}
                      onChange={(e) => update('language', e.target.value)}
                    >
                      <option value="any">Any</option>
                      {LANGS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Open to new members */}
                  <div>
                    <div className="filters-label">Membership</div>
                    <select
                      className="filters-select"
                      value={filters.open}
                      onChange={(e) => update('open', e.target.value)}
                    >
                      <option value="any">Any</option>
                      <option value="open">Open to new members</option>
                      <option value="closed">By request / closed</option>
                    </select>
                  </div>

                  {/* Genres (multi) */}
                  <div className="filters-genres">
                    <div className="filters-label">Favourite genres</div>
                    <div className="filters-genres-grid">
                      {GENRES.map((g) => (
                        <label key={g} className="filters-chip">
                          <input
                            type="checkbox"
                            checked={filters.genres.includes(g)}
                            onChange={() => toggleGenre(g)}
                          />
                          <span>{g}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="filters-footer">
                  <button className="filters-clear" onClick={clearAll}>
                    Clear all
                  </button>
                  <button
                    className="filters-apply"
                    onClick={() => setOpenFilters(false)}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Carousel */}
        <section className="p-5">
          {!loadingClubs && combined.length === 0 && (
            <div className="mb-4 text-sm text-zinc-400">
              No clubs yet. Create the first one!
            </div>
          )}
          {!loadingClubs && combined.length > 0 && filtered.length === 0 && (
            <div className="mb-4 text-sm text-zinc-400">
              No clubs match your search/filters. Showing all clubs instead.
            </div>
          )}
          {combined.length > 0 && (
            <Swiper
              {...swiperConfig}
              onSwiper={(s) => (swiperRef.current = s)}
              className="!w-full"
            >
              {[...(filtered.length ? filtered : combined), ...(filtered.length ? filtered : combined)].map(
                (club, index) => {
                  const m = club.meta || {};
                  return (
                    <SwiperSlide
                      key={`popular-${club.id}-${index}`}
                      className="!w-[220px]"
                    >
                      <Link
                        to={`/club/${club.id}`}
                        className="club-card block bg-zinc-800 rounded-lg border border-zinc-700 shadow-md
                               transition-transform duration-150 ease-out hover:scale-[1.02]"
                        onMouseEnter={(e) => handleEnter(e, club, index)}
                        onMouseLeave={handleLeave}
                      >
                        <div className="w-full h-56 bg-zinc-700 rounded-t-lg overflow-hidden club-media">
                          <img
                            src={club.image}
                            alt={club.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src =
                                'https://via.placeholder.com/300x160?text=Coming+Soon';
                            }}
                          />
                          <div className="club-badges">
                            {m.isNew && (
                              <span className="badge">
                                <span className="badge-dot" />New
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
                        <div className="p-3 text-white text-lg font-semibold">
                          {club.name}
                        </div>
                      </Link>
                    </SwiperSlide>
                  );
                }
              )}
            </Swiper>
          )}
        </section>

        {/* Happening soon */}
        <section className="px-5 pb-10">
          <div className="flex items-center justify_between mb-3">
            <h3 className="text-xl font-semibold text-[rgb(var(--brand-yellow))]">
              Happening soon
            </h3>
            <Link
              to="/events"
              className="text-sm text-zinc-400 hover:text-zinc-200"
            >
              See all
            </Link>
          </div>

          {loadingEvents ? (
            <p className="text-sm text-zinc-400">
              Loading upcoming events…
            </p>
          ) : !upcomingEvents.length ? (
            <p className="text-sm text-zinc-400">
              Events taking place soon will show up here.
            </p>
          ) : (
            <div className="events-grid">
              {upcomingEvents.slice(0, 6).map((ev) => (
                <Link
                  key={`soon-${ev.id}`}
                  to={`/events/${ev.id}`}
                  className="event-card"
                >
                  <div className="event-thumb">
                    <img
                      src={ev.clubImage}
                      alt={ev.clubName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src =
                          'https://via.placeholder.com/300x160?text=Club';
                      }}
                    />
                  </div>

                  <div className="event-info">
                    <div className="event-title">{ev.title}</div>
                    <div className="event-sub">
                      <span className="event-dot" /> {ev.clubName} •{' '}
                      {formatEventDateTime(ev.starts_at)}
                    </div>
                  </div>

                  <div className="event-go" aria-label="Go to event">
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      aria-hidden="true"
                    >
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