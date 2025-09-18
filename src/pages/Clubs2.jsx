// src/pages/Clubs2.jsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/navigation';
import { Navigation, Mousewheel, Keyboard } from 'swiper/modules';

import '../App.css';
import './Clubs2.css';

/* ---------- Base data ---------- */
const baseClubs = [
  { id: '1', name: 'Club 001', image: '/club-images/Club1-PFP.jpeg' },
  { id: '2', name: 'Club 002', image: '/club-images/Club2-PFP.jpeg' },
  { id: '3', name: 'Club 003', image: '/club-images/Club3-PFP.jpeg' },
  { id: '4', name: 'Club 004', image: '/club-images/Club4-PFP.jpeg' },
  { id: '5', name: 'Club 005', image: '/club-images/Club5-PFP.jpeg' },
  { id: '6', name: 'Club 006', image: '/club-images/Club6-PFP.jpeg' },
  { id: '7', name: 'Club 007', image: '/club-images/Club7-PFP.jpeg' },
  { id: '8', name: 'Club 008', image: '/club-images/Club8-PFP.jpeg' },
  { id: '9', name: 'Club 009', image: '/club-images/Club9-PFP.jpeg' },
  { id: '10', name: 'Club 010', image: '/club-images/Club10-PFP.jpeg' },
];

/* Deterministic “metadata” so filters + badges have something to work with */
const SIZES = ['Small (≤50)', 'Medium (50–150)', 'Large (150+)'];
const SIZE_KEY = ['small', 'medium', 'large'];
const LOCATIONS = ['North America', 'Europe', 'Asia', 'South America', 'Africa', 'Oceania', 'Online'];
const ACTIVITY = ['Chill', 'Active', 'Very Active'];
const MEETING = ['Weeknights', 'Weekends', 'Late Night'];
const FORMAT = ['Online', 'In-person', 'Hybrid'];
const LANGS = ['English', 'Spanish', 'French', 'German', 'Polish'];
const GENRES = ['Drama', 'Thriller', 'Horror', 'Comedy', 'Sci-Fi', 'Action', 'Indie', 'Documentary', 'Romance', 'Animation'];

function enrichClubs(list) {
  return list.map((c, i) => ({
    ...c,
    meta: {
      size: SIZE_KEY[i % SIZE_KEY.length],
      location: LOCATIONS[i % LOCATIONS.length],
      activity: ACTIVITY[(i * 2) % ACTIVITY.length],
      meeting: MEETING[(i * 3) % MEETING.length],
      format: FORMAT[(i * 5) % FORMAT.length],
      language: LANGS[(i * 7) % LANGS.length],
      open: i % 3 !== 0, // open to new members
      genres: [GENRES[i % GENRES.length], GENRES[(i + 3) % GENRES.length]],
      members: 80 + ((i * 13) % 120),

      // --- demo badges ---
      isNew: i < 3 || i % 5 === 0,
      activeThisWeek: (i * 7) % 3 !== 0,
      liveSoon: i % 4 === 2,
    },
  }));
}

/* ---------- Swiper config ---------- */
const swiperConfig = {
  modules: [Navigation, Mousewheel, Keyboard],
  slidesPerView: 'auto',
  spaceBetween: 16,
  navigation: false,            // no arrows
  loop: true,
  grabCursor: true,
  simulateTouch: true,
  threshold: 5,
  mousewheel: { forceToAxis: true, releaseOnEdges: false, sensitivity: 0.6 },
  keyboard: { enabled: true, onlyInViewport: true },
};

/* ---------- Tooltip filler ---------- */
function buildFiller(club, idx) {
  const summaries = [
    'Weekly watch parties & scene breakdowns.',
    'Directors’ spotlights and script chats.',
    'Indie gems & festival picks.',
    'Cult classics after dark.',
    'Global cinema—subs welcome.',
  ];
  const genres = ['Drama • Thriller', 'Sci-Fi • Action', 'Indie • Art-house', 'Horror • Mystery', 'Comedy • Slice-of-life'];
  const events = ['Thu 7pm — Watch party', 'Sat 5pm — Panel', 'Tue 8pm — Script clinic', 'Fri 9pm — Double feature', 'Sun 3pm — Shorts swap'];
  return {
    members: 80 + ((idx * 13) % 120),
    summary: summaries[idx % summaries.length],
    upcoming: events[(idx + 2) % events.length],
    fav: genres[(idx + 1) % genres.length],
  };
}

/* ---------- Hover overlay (with badges + tooltip) ---------- */
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
          {/* badges in overlay */}
          <div className="club-badges">
            {m.isNew && <span className="badge"><span className="badge-dot" />New</span>}
            {m.activeThisWeek && <span className="badge"><span className="badge-dot" />Active this week</span>}
            {m.liveSoon && <span className="badge"><span className="badge-dot" />Live soon</span>}
          </div>
        </div>
        <div className="p-3 text-white text-lg font-semibold">{club.name}</div>
      </div>

      {/* tooltip */}
      <div className={`club-tooltip ${showTooltip ? 'show' : ''}`}>
        <div className="club-tooltip__row"><span className="club-dot" /> <strong className="mr-1">Members:</strong> {tooltipData?.members ?? '—'}</div>
        <div className="club-tooltip__row"><span className="club-dot" /> <strong className="mr-1">Summary:</strong> {tooltipData?.summary ?? '—'}</div>
        <div className="club-tooltip__row"><span className="club-dot" /> <strong className="mr-1">Upcoming:</strong> {tooltipData?.upcoming ?? '—'}</div>
        <div className="club-tooltip__row"><span className="club-dot" /> <strong className="mr-1">Fav genres:</strong> {tooltipData?.fav ?? '—'}</div>
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
  open: 'any',          // any | open | closed
  genres: [],           // multi
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
  if (f.genres.length > 0 && !meta.genres.some((g) => f.genres.includes(g))) return false; // match ANY selected genre
  return true;
}

export default function Clubs2() {
  /* ----- hover + tooltip state ----- */
  const [hover, setHover] = useState(null);          // { el, club, idx }
  const [showTip, setShowTip] = useState(false);
  const [tipData, setTipData] = useState(null);
  const timerRef = useRef(null);
  const swiperRef = useRef(null);

  const clearTipTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  const cancelHover = useCallback(() => {
    clearTipTimer();
    setShowTip(false);
    setHover(null);
  }, []);

  // cancel tooltip/overlay on interactions (wheel/scroll/keys/slide)
  useEffect(() => {
    if (!hover) return;
    const onWheel = () => cancelHover();
    const onScroll = () => cancelHover();
    const onKey = (e) => {
      const k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'PageUp' || k === 'PageDown' || k === 'Home' || k === 'End' || k === ' ')
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
      ['touchStart','sliderMove','transitionStart','slideChange'].forEach(bind);
    }

    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onKey);
      detach.forEach((fn) => fn && fn());
    };
  }, [hover, cancelHover]);

  const handleEnter = useCallback((e, club, idx) => {
    setHover({ el: e.currentTarget, club, idx });
    setShowTip(false);
    clearTipTimer();
    const data = buildFiller(club, idx);
    setTipData(data);
    timerRef.current = setTimeout(() => setShowTip(true), 1000); // 1s delay
  }, []);
  const handleLeave = useCallback(() => cancelHover(), [cancelHover]);

  /* ----- filters state ----- */
  const allClubs = enrichClubs(baseClubs);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [openFilters, setOpenFilters] = useState(false);
  const panelRef = useRef(null);

  const activeCount =
    (filters.size !== 'any') +
    (filters.location !== 'any') +
    (filters.activity !== 'any') +
    (filters.meeting !== 'any') +
    (filters.format !== 'any') +
    (filters.language !== 'any') +
    (filters.open !== 'any') +
    (filters.genres.length > 0 ? 1 : 0);

  const filtered = allClubs.filter((c) => passesFilters(c.meta, filters));
  const baseForCarousel = filtered.length > 0 ? filtered : allClubs;
  const carouselClubs = [...baseForCarousel, ...baseForCarousel]; // loop stability

  // Close filters on outside click / Esc
  useEffect(() => {
    if (!openFilters) return;
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpenFilters(false);
    };
    const onEsc = (e) => { if (e.key === 'Escape') setOpenFilters(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [openFilters]);

  const update = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const toggleGenre = (g) =>
    setFilters((f) => {
      const has = f.genres.includes(g);
      return { ...f, genres: has ? f.genres.filter((x) => x !== g) : [...f.genres, g] };
    });
  const clearAll = () => setFilters(DEFAULT_FILTERS);

  return (
    <div className="clubs2 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]
                    xl:grid xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-6
                    h-[calc(100vh-88px)] overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden xl:block w-64 h-full overflow-y-auto px-4 pt-8 pb-8
                        bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl
                        text-sm text-zinc-300">
        {/* Editor's Pick */}
        <div>
          <h3 className="text-white text-lg font-semibold mb-2">Editor's Pick</h3>

          {/* Cinema Club */}
          <button
            type="button"
            className="pick-card mb-4"
            onClick={() => { console.log('Go to Cinema Club'); }}
          >
            <p className="text-white font-medium">Cinema Club</p>
            <p className="text-xs mt-1 text-zinc-400">New short film collab this week.</p>
          </button>

          {/* Critic's Choice */}
          <button
            type="button"
            className="pick-card"
            onClick={() => { console.log("Go to Critic's Choice"); }}
          >
            <p className="text-white font-medium">Critic's Choice</p>
            <p className="text-xs mt-1 text-zinc-400">A24 Fans Group Meeting Soon</p>
          </button>
        </div>

        <div className="mt-6">
          <h3 className="text-white text-lg font-semibold mb-2">Explore</h3>
          <ul className="space-y-2">
            <li><Link to="/events" className="text-white hover:text-zinc-300">Events</Link></li>
            <li><Link to="/my-club" className="text-white hover:text-zinc-300">My Club</Link></li>
            <li><Link to="/create-club" className="text-white hover:text-zinc-300">Create Club</Link></li>
            <li><Link to="/search" className="text-white hover:text-zinc-300">Search Clubs</Link></li>
            <li><Link to="/leaderboard" className="text-white hover:text-zinc-300">Leaderboard</Link></li>
          </ul>
        </div>
      </aside>

<<<<<<< HEAD
      <main className="relative flex-1 min-w-0 h-full overflow-y-auto pr-6 pt-8
                      bg-gradient-to-b from-zinc-900 via-black to-zinc-900">
=======
      {/* Main */}
      <main className="relative flex-1 min-w-0 h-full overflow-y-auto pr-6 pt-8">
>>>>>>> 9c224e1 (Events page added)
        <div className="flex items-end justify-between mb-4 pr-2">
          <div>
            <h2 className="text-3xl font-bold mb-1">Popular</h2>
            <p className="text-sm text-zinc-400">Scroll to explore more</p>
          </div>

          {/* Filters button */}
          <div className="relative" ref={panelRef}>
            <button
              className={`filters-btn ${openFilters ? 'is-open' : ''} ${activeCount ? 'has-active' : ''}`}
              onClick={() => setOpenFilters((v) => !v)}
              aria-expanded={openFilters}
              aria-haspopup="menu"
            >
              <span>Filters</span>
              {activeCount > 0 && <span className="filters-badge">{activeCount}</span>}
              <svg className="filters-caret" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {openFilters && (
              <div className="filters-panel" role="menu">
                <div className="filters-grid">
                  {/* Size */}
                  <div>
                    <div className="filters-label">Club size</div>
                    <select className="filters-select" value={filters.size} onChange={(e) => update('size', e.target.value)}>
                      <option value="any">Any</option>
                      <option value="small">{SIZES[0]}</option>
                      <option value="medium">{SIZES[1]}</option>
                      <option value="large">{SIZES[2]}</option>
                    </select>
                  </div>

                  {/* Location */}
                  <div>
                    <div className="filters-label">Location</div>
                    <select className="filters-select" value={filters.location} onChange={(e) => update('location', e.target.value)}>
                      <option value="any">Any</option>
                      {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>

                  {/* Activity */}
                  <div>
                    <div className="filters-label">How active</div>
                    <select className="filters-select" value={filters.activity} onChange={(e) => update('activity', e.target.value)}>
                      <option value="any">Any</option>
                      {ACTIVITY.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>

                  {/* Meeting time */}
                  <div>
                    <div className="filters-label">Meeting time</div>
                    <select className="filters-select" value={filters.meeting} onChange={(e) => update('meeting', e.target.value)}>
                      <option value="any">Any</option>
                      {MEETING.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>

                  {/* Format */}
                  <div>
                    <div className="filters-label">Format</div>
                    <select className="filters-select" value={filters.format} onChange={(e) => update('format', e.target.value)}>
                      <option value="any">Any</option>
                      {FORMAT.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>

                  {/* Language */}
                  <div>
                    <div className="filters-label">Language</div>
                    <select className="filters-select" value={filters.language} onChange={(e) => update('language', e.target.value)}>
                      <option value="any">Any</option>
                      {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>

                  {/* Open to new members */}
                  <div>
                    <div className="filters-label">Membership</div>
                    <select className="filters-select" value={filters.open} onChange={(e) => update('open', e.target.value)}>
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
                  <button className="filters-clear" onClick={clearAll}>Clear all</button>
                  <button className="filters-apply" onClick={() => setOpenFilters(false)}>Done</button>
                </div>
              </div>
            )}
          </div>
        </div>

<<<<<<< HEAD
        <section className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-5 overflow-hidden">
          <Swiper {...swiperConfig} className="!w-full">
            {popularClubs.map((club, index) => (
              <SwiperSlide key={`popular-${index}`} className="!w-[220px]">
                <Link to={`/club/${club.id}`} className="block bg-zinc-800 rounded-lg border border-zinc-700 shadow-md hover:shadow-yellow-500/20 hover:border-zinc-500 transition-transform duration-300 ease-out hover:scale-105">
                  <div className="w-full h-56 bg-zinc-700 rounded-t-lg overflow-hidden">
                    <img
                      src={club.image}
                      alt={club.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/300x160?text=Coming+Soon'; }}
                    />
                  </div>
                  <div className="p-3 text-white text-lg font-semibold">{club.name}</div>
                </Link>
              </SwiperSlide>
            ))}
=======
        {/* Carousel */}
        <section className="p-5">
          {filtered.length === 0 && (
            <div className="mb-4 text-sm text-zinc-400">
              No clubs match your filters. Showing all clubs instead.
            </div>
          )}
          <Swiper {...swiperConfig} onSwiper={(s) => (swiperRef.current = s)} className="!w-full">
            {carouselClubs.map((club, index) => {
              const m = club.meta || {};
              return (
                <SwiperSlide key={`popular-${index}`} className="!w-[220px]">
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
                        onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/300x160?text=Coming+Soon'; }}
                      />
                      {/* badges in card */}
                      <div className="club-badges">
                        {m.isNew && <span className="badge"><span className="badge-dot" />New</span>}
                        {m.activeThisWeek && <span className="badge"><span className="badge-dot" />Active this week</span>}
                        {m.liveSoon && <span className="badge"><span className="badge-dot" />Live soon</span>}
                      </div>
                    </div>
                    <div className="p-3 text-white text-lg font-semibold">{club.name}</div>
                  </Link>
                </SwiperSlide>
              );
            })}
>>>>>>> 9c224e1 (Events page added)
          </Swiper>
        </section>
        {/* Happening soon */}
<section className="px-5 pb-10">
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-xl font-semibold">Happening soon</h3>
    <Link to="/events" className="text-sm text-zinc-400 hover:text-zinc-200">See all</Link>
  </div>

  <div className="events-grid">
    {(baseForCarousel.length ? baseForCarousel : allClubs).slice(0, 6).map((c, i) => {
      const f = buildFiller(c, i);
      return (
        <Link key={`soon-${c.id}-${i}`} to={`/club/${c.id}`} className="event-card">
          <div className="event-thumb">
            <img
              src={c.image}
              alt={c.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/300x160?text=Club'; }}
            />
          </div>

          <div className="event-info">
            <div className="event-title">{f.upcoming}</div>
            <div className="event-sub">
              <span className="event-dot" /> {c.name}
            </div>
          </div>

          <div className="event-cta">Details</div>
        </Link>
      );
    })}
  </div>
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