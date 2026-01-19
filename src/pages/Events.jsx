// src/pages/Events.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Events.css";
import supabase from "../supabaseClient.js";
import useRealtimeResume from "../hooks/useRealtimeResume";

const EVENTS_CACHE_KEY = "cache:events:v1";
const EVENTS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const FALLBACK_EVENT_IMAGE = "https://placehold.co/600x800?text=Event";
const EVENTS_SELECT_FULL = [
  "id",
  "slug",
  "title",
  "date",
  "venue",
  "poster_url",
  "tags",
  "summary",
  "club_id",
  "club_name",
  "lat",
  "lon",
  "city_name",
].join(", ");
const EVENTS_SELECT_MIN = [
  "id",
  "slug",
  "title",
  "date",
  "venue",
  "poster_url",
  "club_id",
  "club_name",
].join(", ");

function readEventsCache() {
  try {
    const raw = sessionStorage.getItem(EVENTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || !Array.isArray(parsed?.data)) return null;
    if (Date.now() - parsed.at > EVENTS_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeEventsCache(data) {
  try {
    sessionStorage.setItem(
      EVENTS_CACHE_KEY,
      JSON.stringify({ at: Date.now(), data })
    );
  } catch {
    /* ignore cache write errors */
  }
}


// ---------------- Row → UI mapper (tolerant to schema) ----------------
function mapRowToEvent(row) {
  const dateIso = row.date ?? null;

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
    slug: row.slug ?? row.event_slug ?? "",   // <-- ADD THIS LINE
    title: row.title ?? "Untitled Event",
    date: dateIso ? new Date(dateIso).toISOString() : new Date().toISOString(),
    venue: row.venue ?? row.location ?? "Venue",
    posterUrl:
      row.poster_url ?? FALLBACK_EVENT_IMAGE,
    tags: Array.isArray(row.tags)
      ? row.tags
      : typeof row.tags === "string"
      ? row.tags.split(",").map((s) => s.trim())
      : [],
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

  return (
    <article className="poster-card">
      <Link
        to={`/events/${evt.slug}`}
        state={{ event: evt }}
        className="block"
      >
        <div className="poster-media">
          <img
            src={evt.posterUrl || FALLBACK_EVENT_IMAGE}
            alt={evt.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.src = FALLBACK_EVENT_IMAGE;
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
  const cached = readEventsCache();
  const [liveEvents, setLiveEvents] = useState(cached || []);
  const [loadingLive, setLoadingLive] = useState(!cached);
  const [query, setQuery] = useState("");
  const resumeTick = useRealtimeResume();

  const location = useLocation();
  const navigate = useNavigate();

  // Accept a new event from /events/new via location.state
  useEffect(() => {
    const newEvt = location.state?.newEvent;
    if (newEvt) {
      setLiveEvents((prev) => {
        const id = newEvt.id ? String(newEvt.id) : null;
        if (id && prev.some((e) => String(e.id) === id)) return prev;
        return [newEvt, ...prev];
      });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Accept a removed event from /events via location.state
  useEffect(() => {
    const removedId = location.state?.removedEventId;
    if (!removedId) return;
    setLiveEvents((prev) => {
      const next = prev.filter((e) => String(e.id) !== String(removedId));
      writeEventsCache(next);
      return next;
    });
    navigate(location.pathname, { replace: true, state: {} });
  }, [location, navigate]);

  // Load from Supabase on mount
  useEffect(() => {
    let mounted = true;

    if (cached?.length) {
      setLiveEvents(cached);
      setLoadingLive(false);
    }

    (async () => {
      try {
        let mapped = [];

        // Attempt broad select first (most tolerant to schema differences)
        try {
          const { data, error } = await supabase
            .from("events")
            .select(EVENTS_SELECT_FULL)
            .order("date", { ascending: true })
            .limit(300);
          if (error) throw error;
          mapped = (data || []).map(mapRowToEvent);
        } catch (primaryErr) {
          console.warn("[events] primary fetch failed, retrying:", primaryErr?.message || primaryErr);
          // Fallback: conservative column list to avoid 400s on missing columns
          const { data, error } = await supabase
            .from("events")
            .select(EVENTS_SELECT_MIN)
            .order("date", { ascending: true })
            .limit(300);
          if (error) throw error;
          mapped = (data || []).map(mapRowToEvent);
        }

        const sorted = mapped.sort(
          (a, b) =>
            new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
        );

        if (mounted) {
          setLiveEvents(sorted);
          writeEventsCache(sorted);
        }
      } catch {
        if (mounted) setLiveEvents([]); // no fallback to fake data
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
    const channel = supabase
      .channel("events-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        (payload) => {
          setLiveEvents((prev) => {
            if (payload.eventType === "INSERT") {
              const e = mapRowToEvent(payload.new);
              if (prev.some((x) => String(x.id) === String(e.id)))
                return prev;
              return [e, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const e = mapRowToEvent(payload.new);
              return prev.map((x) =>
                String(x.id) === String(e.id) ? e : x
              );
            }
            if (payload.eventType === "DELETE") {
              const id = String(payload.old.id);
              return prev.filter((x) => String(x.id) !== id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [resumeTick]);

  // Only live events — no mock fallback
  const base = liveEvents;

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
            {loadingLive
              ? "Loading live events…"
              : "Find screenings, watch parties and club meetups."}
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
          <PosterCard key={`${evt.slug}`} evt={evt} />
        ))}
        {filtered.length === 0 && !loadingLive && (
          <div className="empty">No events found.</div>
        )}
      </section>
    </div>
  );
}
