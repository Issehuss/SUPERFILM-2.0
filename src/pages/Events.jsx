// src/pages/Events.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Events.css";
import { supabase } from "../lib/supabaseClient";

// ---------------- Demo fallback (unchanged look) ----------------
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
      lat: 51.5074,
      lon: -0.1278,
      cityName: "London",
    });
  });
  return out;
}

// ---------------- Row → UI mapper (tolerant to schema) ----------------
function mapRowToEvent(row) {
  // Try to get an ISO date for filtering/formatting
  const dateIso =
    row.datetime ??
    row.date_time ??
    row.date ??
    row.starts_at ??
    row.start_time ??
    null;

  // club fields – either joined or just club_id
  const club = row.clubs || row.club || {};
  const clubName =
    row.club_name ??
    club.name ??
    row.club?.name ??
    row.clubName ??
    "Club";

  const clubId = String(row.club_id ?? club.id ?? row.clubId ?? "");

  return {
    id: String(row.id),
    title: row.title ?? "Untitled Event",
    date: dateIso ? new Date(dateIso).toISOString() : new Date().toISOString(),
    venue: row.venue ?? row.location ?? "Venue",
    posterUrl:
      row.poster_url ??
      row.image_url ??
      "https://via.placeholder.com/600x800?text=Event+Poster",
    tags: Array.isArray(row.tags)
      ? row.tags
      : (typeof row.tags === "string" ? row.tags.split(",").map(s => s.trim()) : []),
    summary: row.summary ?? row.description ?? "",
    clubId,
    clubName,
    lat: typeof row.lat === "number" ? row.lat : undefined,
    lon: typeof row.lon === "number" ? row.lon : undefined,
    cityName: row.city_name ?? row.city ?? undefined,
  };
}

/* ---------------- Small Card ---------------- */
function PosterCard({ evt }) {
  const d = new Date(evt.date);
  const month = d.toLocaleString(undefined, { month: "short" });
  const day = d.getDate();
  const toHref = evt.id.startsWith("seed-") ? `/club/${evt.clubId}` : `/events/${evt.id}`;

  return (
    <article className="poster-card">
      <Link to={toHref} className="block">
        <div className="poster-media">
          <img
            src={evt.posterUrl}
            alt={evt.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src =
                "https://via.placeholder.com/600x800?text=Event+Poster";
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

/* ---------------- Page ---------------- */
export default function Events() {
  const [liveEvents, setLiveEvents] = useState([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [query, setQuery] = useState("");

  const location = useLocation();
  const navigate = useNavigate();

  // Accept a new event from /events/new via location.state
  useEffect(() => {
    const newEvt = location.state?.newEvent;
    if (newEvt) {
      // optimistic prepend even before Supabase refresh catches it
      setLiveEvents((prev) => {
        // if it has an id, avoid dupes
        const id = newEvt.id ? String(newEvt.id) : null;
        if (id && prev.some((e) => String(e.id) === id)) return prev;
        return [newEvt, ...prev];
      });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Load from Supabase on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!supabase) throw new Error("Supabase not configured");
        // If you have a relation to clubs, you can select it: .select('*, clubs(name,id)')
        const { data, error } = await supabase
          .from("events")
          .select("*")
          .order("date", { ascending: true })
          .limit(300);
        if (error) throw error;
        const mapped = (data || []).map(mapRowToEvent);
        if (mounted) setLiveEvents(mapped);
      } catch {
        if (mounted) setLiveEvents([]);
      } finally {
        if (mounted) setLoadingLive(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Realtime updates
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("events-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, (payload) => {
        setLiveEvents((prev) => {
          if (payload.eventType === "INSERT") {
            const e = mapRowToEvent(payload.new);
            if (prev.some((x) => String(x.id) === String(e.id))) return prev;
            return [e, ...prev];
          }
          if (payload.eventType === "UPDATE") {
            const e = mapRowToEvent(payload.new);
            return prev.map((x) => (String(x.id) === String(e.id) ? e : x));
          }
          if (payload.eventType === "DELETE") {
            const id = String(payload.old.id);
            return prev.filter((x) => String(x.id) !== id);
          }
          return prev;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Choose data: live if present, else mock
  const base = liveEvents.length ? liveEvents : seedEvents();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.clubName.toLowerCase().includes(q) ||
        (e.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [base, query]);

  return (
    <div className="events-page">
      <header className="page-head">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-zinc-400 mt-1">
            {loadingLive ? "Loading live events…" : "Find screenings, watch parties and club meetups."}
          </p>
        </div>

        <div className="head-actions">
          <input
            className="search"
            placeholder="Search events..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Link to="/events/new" className="btn primary">
            List Event
          </Link>
        </div>
      </header>

      <section className="poster-grid">
        {filtered.map((evt) => (
          <PosterCard key={`${evt.id}`} evt={evt} />
        ))}
        {filtered.length === 0 && (
          <div className="empty">No events match your search.</div>
        )}
      </section>
    </div>
  );
}