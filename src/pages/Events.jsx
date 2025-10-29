// src/pages/Events.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Events.css"; // removed SideBanners.css import

/* ---------------- Small local gazetteer (demo) ---------------- */
const LOCAL_PLACES = [
  { name: "London", lat: 51.5074, lon: -0.1278 },
  { name: "Manchester", lat: 53.4808, lon: -2.2426 },
  { name: "Birmingham", lat: 52.4862, lon: -1.8904 },
  { name: "Leeds", lat: 53.8008, lon: -1.5491 },
  { name: "Bristol", lat: 51.4545, lon: -2.5879 },
];

/* --------------- Demo club data ------------------- */
const CLUBS = [
  { id: "1", name: "Cinephiles United", image: "/club-images/Club1-PFP.jpeg" },
  { id: "2", name: "Frame by Frame", image: "/club-images/Club2-PFP.jpeg" },
  { id: "3", name: "The Reel Critics", image: "/club-images/Club3-PFP.jpeg" },
  { id: "4", name: "Indie Icons", image: "/club-images/Club4-PFP.jpeg" },
  { id: "5", name: "Hollywood Nights", image: "/club-images/Club5-PFP.jpeg" },
  { id: "6", name: "Foreign Film Society", image: "/club-images/Club6-PFP.jpeg" },
  { id: "7", name: "Late Night Screenings", image: "/club-images/Club7-PFP.jpeg" },
  { id: "8", name: "Couch Critics", image: "/club-images/Club8-PFP.jpeg" },
  { id: "9", name: "Cinema Underground", image: "/club-images/Club9-PFP.jpeg" },
  { id: "10", name: "Projector Club", image: "/club-images/Club10-PFP.jpeg" },
];

/* ---------------- Seed events (with coords) --------------- */
function seedEvents() {
  const now = new Date();
  const addDays = (n) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d;
  };
  const picks = [
    { title: "Thriller Night Double Bill", tags: ["Thriller", "Neo-Noir"] },
    { title: "Animation & Storytelling", tags: ["Animation"] },
    { title: "Indie Gems Watch Party", tags: ["Indie"] },
    { title: "Horror After Dark", tags: ["Horror"] },
    { title: "Comedy & Romance", tags: ["Comedy", "Romance"] },
  ];
  const venues = ["Online", "Campus Theatre", "Studio 2", "Community Hall"];

  const out = [];
  CLUBS.forEach((club, i) => {
    const p = picks[i % picks.length];
    const place = LOCAL_PLACES[i % LOCAL_PLACES.length];
    out.push({
      id: `seed-${i}`,
      clubId: club.id,
      clubName: club.name,
      date: addDays((i * 3) % 20).toISOString(),
      title: p.title,
      venue: venues[i % venues.length],
      posterUrl: club.image,
      tags: p.tags,
      summary: "Join us for a screening + discussion. Open to all.",
      lat: place.lat,
      lon: place.lon,
      cityName: place.name,
    });
  });
  return out;
}

/* ---------------- Card ---------------- */
function PosterCard({ evt }) {
  const d = new Date(evt.date);
  const month = d.toLocaleString(undefined, { month: "short" });
  const day = d.getDate();
  const toHref = evt.id === "seed-0" ? `/events/${evt.id}` : `/club/${evt.clubId}`;

  return (
    <article className="poster-card">
      <Link to={toHref} className="block">
        <div className="poster-media">
          <img
            src={evt.posterUrl}
            alt={evt.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = "https://via.placeholder.com/600x800?text=Event+Poster";
            }}
          />
          <div className="poster-date">
            <div className="m">{month}</div>
            <div className="d">{day}</div>
          </div>
        </div>
        <div className="poster-info">
          <h3 className="title">{evt.title}</h3>
          <div className="meta">
            <span className="dot" />
            {evt.clubName} • {evt.venue}
          </div>
          {evt.tags?.length ? (
            <div className="tags">
              {evt.tags.slice(0, 3).map((t) => (
                <span key={t} className="tag">{t}</span>
              ))}
            </div>
          ) : null}
          {evt.summary && <p className="summary">{evt.summary}</p>}
        </div>
      </Link>
    </article>
  );
}

/* ---------------- Filter helpers ---------------- */
const DEFAULT_FILTERS = {
  whenMode: "any",       // any | date | within
  whenDate: "",          // YYYY-MM-DD
  withinDays: 7,         // for "within"
  timeOfDay: "any",      // any | morning | noon | afternoon | evening
  whereQuery: "",        // user-typed string
  center: null,          // {lat, lon, label} once resolved
  radiusKm: 25,
  tags: [],
};

function inWhenWindow(iso, f) {
  if (f.whenMode === "any") return true;
  const d = new Date(iso);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  if (f.whenMode === "date" && f.whenDate) {
    const target = new Date(f.whenDate + "T00:00:00");
    const end = new Date(target);
    end.setDate(end.getDate() + 1);
    return d >= target && d < end;
  }

  if (f.whenMode === "within") {
    const end = new Date(startOfToday);
    const n = Math.max(1, Number(f.withinDays) || 1);
    end.setDate(end.getDate() + n);
    return d >= startOfToday && d < end;
  }

  return true;
}

function matchesTimeOfDay(iso, timeOfDay) {
  if (timeOfDay === "any") return true;
  const h = new Date(iso).getHours();
  if (timeOfDay === "morning") return h >= 5 && h < 12;
  if (timeOfDay === "noon") return h >= 12 && h < 14;
  if (timeOfDay === "afternoon") return h >= 14 && h < 18;
  if (timeOfDay === "evening") return h >= 18 && h <= 23;
  return true;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* ----------- Local "geocoder" (no network) ---------- */
function tryResolveLocation(input) {
  const q = (input || "").trim();
  if (!q) return null;

  // 1) "lat,lon"
  const m = q.match(/^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/);
  if (m) {
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[3]);
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      return { lat, lon, label: `${lat.toFixed(4)}, ${lon.toFixed(4)}` };
    }
  }

  // 2) fuzzy match demo gazetteer
  const exact = LOCAL_PLACES.find((p) => p.name.toLowerCase() === q.toLowerCase());
  if (exact) return { lat: exact.lat, lon: exact.lon, label: exact.name };

  const contains = LOCAL_PLACES.find((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  if (contains) return { lat: contains.lat, lon: contains.lon, label: contains.name };

  return null;
}

/* ---------------- Page ---------------- */
export default function Events() {
  const [events, setEvents] = useState(() => seedEvents());
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [openFilters, setOpenFilters] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const panelRef = useRef(null);

  // Accept a new event from /events/new
  useEffect(() => {
    const newEvt = location.state?.newEvent;
    if (newEvt) {
      setEvents((prev) => [newEvt, ...prev]);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Tag list for UI
  const allTags = useMemo(() => {
    const s = new Set();
    events.forEach((e) => (e.tags || []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [events]);

  // Close filters on outside click/Escape
  useEffect(() => {
    if (!openFilters) return;
    const onDown = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpenFilters(false);
    };
    const onEsc = (e) => { if (e.key === "Escape") setOpenFilters(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [openFilters]);

  const toggleTag = (t) =>
    setFilters((f) => {
      const has = f.tags.includes(t);
      return { ...f, tags: has ? f.tags.filter((x) => x !== t) : [...f.tags, t] };
    });

  const setCenter = (center) => setFilters((f) => ({ ...f, center }));

  const handleResolveClick = () => {
    const res = tryResolveLocation(filters.whereQuery);
    setCenter(res);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setCenter({ lat, lon, label: "My location" });
      },
      () => {
        // swallow errors silently; keep previous center
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 8000 }
    );
  };

  // Filtering (query + options)
  const filtered = useMemo(() => {
    return events.filter((e) => {
      const q = query.trim().toLowerCase();
      if (
        q &&
        !(
          e.title.toLowerCase().includes(q) ||
          e.clubName.toLowerCase().includes(q) ||
          e.tags?.some((t) => t.toLowerCase().includes(q))
        )
      ) return false;

      if (!inWhenWindow(e.date, filters)) return false;
      if (!matchesTimeOfDay(e.date, filters.timeOfDay)) return false;

      if (filters.center) {
        const { lat: cLat, lon: cLon } = filters.center;
        if (typeof e.lat !== "number" || typeof e.lon !== "number") return false;
        const dist = haversineKm(cLat, cLon, e.lat, e.lon);
        if (dist > (Number(filters.radiusKm) || 0)) return false;
      }

      if (filters.tags.length > 0) {
        const evTags = e.tags || [];
        const ok = filters.tags.every((t) => evTags.includes(t));
        if (!ok) return false;
      }

      return true;
    });
  }, [events, query, filters]);

  const activeCount =
    (filters.whenMode !== "any") +
    (filters.timeOfDay !== "any") +
    (filters.center ? 1 : 0) +
    (filters.tags.length > 0 ? 1 : 0);

  const clearAll = () => setFilters(DEFAULT_FILTERS);

  return (
    <div className="events-page">
      <header className="page-head">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-zinc-400 mt-1">Find screenings, watch parties and club meetups.</p>
        </div>

        {/* Search + Filters */}
        <div className="head-actions">
          <input
            className="search"
            placeholder="Search events..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="relative" ref={panelRef} style={{ display: "inline-block" }}>
            <button
              className={`filters-btn ${openFilters ? "is-open" : ""} ${activeCount ? "has-active" : ""}`}
              onClick={() => setOpenFilters((v) => !v)}
              aria-expanded={openFilters}
              aria-haspopup="menu"
            >
              <span>Filters</span>
              {activeCount > 0 && <span className="filters-badge">{activeCount}</span>}
              <svg className="filters-caret" viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {openFilters && (
              <div
                role="menu"
                className="filters-panel"
                style={{
                  position: "absolute",
                  top: "110%",
                  right: 0,
                  minWidth: 340,
                  background: "var(--panel, #0f1115)",
                  border: "1px solid #2b2c34",
                  borderRadius: 12,
                  padding: 12,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                  zIndex: 10,
                }}
              >
                <div style={{ display: "grid", gap: 12 }}>
                  {/* When */}
                  <div>
                    <div className="label" style={{ marginBottom: 6 }}>When</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <select
                        className="input"
                        value={filters.whenMode}
                        onChange={(e) => setFilters((f) => ({ ...f, whenMode: e.target.value }))}
                      >
                        <option value="any">Any time</option>
                        <option value="date">Specific date</option>
                        <option value="within">Within N days</option>
                      </select>

                      {filters.whenMode === "date" && (
                        <input
                          type="date"
                          className="input"
                          value={filters.whenDate}
                          onChange={(e) => setFilters((f) => ({ ...f, whenDate: e.target.value }))}
                        />
                      )}

                      {filters.whenMode === "within" && (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="number"
                            min={1}
                            className="input"
                            style={{ width: 110 }}
                            value={filters.withinDays}
                            onChange={(e) => setFilters((f) => ({ ...f, withinDays: e.target.value }))}
                          />
                          <div style={{ display: "flex", gap: 6 }}>
                            <button type="button" className="btn ghost sm" onClick={() => setFilters((f) => ({ ...f, withinDays: 7 }))}>7 days</button>
                            <button type="button" className="btn ghost sm" onClick={() => setFilters((f) => ({ ...f, withinDays: 30 }))}>30 days</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Time of day */}
                  <div>
                    <div className="label" style={{ marginBottom: 6 }}>Time</div>
                    <select
                      className="input"
                      value={filters.timeOfDay}
                      onChange={(e) => setFilters((f) => ({ ...f, timeOfDay: e.target.value }))}
                    >
                      <option value="any">Any</option>
                      <option value="morning">Morning (05:00–12:00)</option>
                      <option value="noon">Noon (12:00–14:00)</option>
                      <option value="afternoon">Afternoon (14:00–18:00)</option>
                      <option value="evening">Evening (18:00–23:59)</option>
                    </select>
                  </div>

                  {/* Where: typed location + radius */}
                  <div>
                    <div className="label" style={{ marginBottom: 6 }}>Where</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          className="input"
                          placeholder="Type a place (e.g., London) or 'lat,lon'"
                          value={filters.whereQuery}
                          onChange={(e) => setFilters((f) => ({ ...f, whereQuery: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") handleResolveClick(); }}
                          style={{ flex: 1 }}
                        />
                        <button type="button" className="btn ghost" onClick={handleResolveClick}>Find</button>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="range"
                          min={1}
                          max={200}
                          step={1}
                          value={filters.radiusKm}
                          onChange={(e) => setFilters((f) => ({ ...f, radiusKm: Number(e.target.value) }))}
                          style={{ flex: 1 }}
                        />
                        <div style={{ width: 64, textAlign: "right" }}>{filters.radiusKm} km</div>
                      </div>

                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <button type="button" className="btn ghost sm" onClick={handleUseMyLocation}>Use my location</button>
                        {filters.center ? (
                          <>
                            <span className="text-zinc-400 text-sm">Using: <strong style={{ color: "#fff" }}>{filters.center.label}</strong></span>
                            <button
                              type="button"
                              className="btn ghost sm"
                              onClick={() => setCenter(null)}
                              aria-label="Clear location"
                            >×</button>
                          </>
                        ) : (
                          <span className="text-zinc-500 text-sm">No location set</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <div className="label" style={{ marginBottom: 6 }}>Tags</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {allTags.length === 0 && <span className="text-zinc-500 text-sm">No tags yet</span>}
                      {allTags.map((t) => {
                        const on = filters.tags.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => toggleTag(t)}
                            className={`chip ${on ? "chip-on" : ""}`}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 999,
                              border: "1px solid #2b2c34",
                              background: on ? "#1f2937" : "transparent",
                              color: "#fff",
                              fontSize: 12,
                            }}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <button className="btn ghost" type="button" onClick={clearAll}>Clear all</button>
                    <button className="btn primary" type="button" onClick={() => setOpenFilters(false)}>Done</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Link to="/events/new" className="btn primary">List Event</Link>
        </div>
      </header>

      <section className="poster-grid">
        {filtered.map((evt) => (
          <PosterCard key={evt.id} evt={evt} />
        ))}
        {filtered.length === 0 && <div className="empty">No events match your search.</div>}
      </section>

      {/* Minimal styles for filter controls */}
      <style>{`
        .filters-btn {
          display:inline-flex; align-items:center; gap:8px;
          padding:8px 12px; border:1px solid #2b2c34; border-radius:10px;
          background:#12141a; color:#fff; cursor:pointer;
        }
        .filters-btn.has-active { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12); }
        .filters-badge {
          display:inline-flex; align-items:center; justify-content:center;
          min-width:18px; height:18px; font-size:12px; border-radius:10px;
          background:#1f2937; padding:0 6px;
        }
        .chip { transition: transform .05s ease; }
        .chip:active { transform: scale(0.98); }
      `}</style>
    </div>
  );
}
