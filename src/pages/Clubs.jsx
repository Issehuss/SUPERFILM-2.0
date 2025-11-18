// src/pages/Clubs.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import supabase from "../supabaseClient.js";
import "../App.css";
import "./Clubs.css";
import { useUser } from "../context/UserContext";
import {
  Users,
  CalendarDays,
  Trophy,
  PlusCircle,
} from "lucide-react";

/* ---------------------------- Helpers ---------------------------- */

function mapRowToClub(row) {
  const meta =
    row.meta && typeof row.meta === "object"
      ? row.meta
      : {
          location: row.location ?? undefined,
          genres: Array.isArray(row.genres) ? row.genres : undefined,
        };

  return {
    id: `db-${row.id}`,
    rawId: row.id,
    name: row.name ?? "Untitled Club",
    image:
      row.profile_image_url ??
      row.image_url ??
      row.image ??
      "https://via.placeholder.com/300x160?text=Club",
    createdAt: row.created_at ?? row.createdAt ?? null,
    meta,
  };
}

function isNewClub(createdAt) {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  const diffDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays <= 7; // new if created in last 7 days
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

/* ----------------------------- Page ----------------------------- */

export default function Clubs() {
  const navigate = useNavigate();
  const { profile } = useUser();
  const userClubId =
    profile?.club_id ?? profile?.current_club_id ?? null;
  const userHasClub = !!userClubId;

  const [liveClubs, setLiveClubs] = useState([]);
  const [loadingClubs, setLoadingClubs] = useState(true);

  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [search, setSearch] = useState("");

  /* ----------------------- Load Clubs ----------------------- */

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("clubs")
          .select("*")
          .limit(200);

        if (error) throw error;
        if (mounted) setLiveClubs(data.map(mapRowToClub));
      } catch (err) {
        console.error("⚠️ Clubs load failed:", err);
        if (mounted) setLiveClubs([]);
      } finally {
        if (mounted) setLoadingClubs(false);
      }
    })();

    return () => (mounted = false);
  }, []);

  /* --------------------- Realtime Sync --------------------- */

  useEffect(() => {
    const channel = supabase
      .channel("clubs-minimal-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clubs" },
        (payload) => {
          setLiveClubs((prev) => {
            if (payload.eventType === "INSERT") {
              const club = mapRowToClub(payload.new);
              if (prev.some((c) => c.id === club.id)) return prev;
              return [club, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const club = mapRowToClub(payload.new);
              return prev.map((c) =>
                c.id === club.id ? club : c
              );
            }
            if (payload.eventType === "DELETE") {
              const id = `db-${payload.old.id}`;
              return prev.filter((c) => c.id !== id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  /* -------------------- Load Upcoming Events -------------------- */

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
            return {
              id: ev.id,
              title:
                ev.title || ev.name || ev.film_title || "Club screening",
              starts_at: ev.starts_at,
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
        console.error("⚠️ Event fetch failed:", e);
        if (mounted) {
          setUpcomingEvents([]);
          setLoadingEvents(false);
        }
      }
    })();

    return () => (mounted = false);
  }, [loadingClubs, liveClubs]);

  /* ---------------------- Search Filter ---------------------- */

  const filteredClubs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return liveClubs;

    return liveClubs.filter((club) => {
      const m = club.meta || {};
      return (
        club.name.toLowerCase().includes(q) ||
        (m.location &&
          m.location.toLowerCase().includes(q)) ||
        (Array.isArray(m.genres) &&
          m.genres.some((g) => g.toLowerCase().includes(q)))
      );
    });
  }, [search, liveClubs]);

  /* -------------------------- Render -------------------------- */

  return (
    <div className="clubs-page">
      <div className="clubs-inner">
        {/* ----------------------- Header ----------------------- */}
        <header className="clubs-header">
          <div className="clubs-header-text">
            <h1 className="clubs-title">Clubs</h1>
            <p className="clubs-subtitle">
              {loadingClubs
                ? "Loading clubs…"
                : `${liveClubs.length} clubs on SuperFilm.`}
            </p>
          </div>

          <div className="clubs-header-actions">
            <input
              className="clubs-search"
              placeholder="Search clubs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <nav className="clubs-quicknav">
              <button
                className="nav-pill"
                onClick={() => navigate("/myclub")}
              >
                <Users className="nav-pill-icon" />
                <span>My Club</span>
              </button>

              <button
                className="nav-pill"
                onClick={() => navigate("/events")}
              >
                <CalendarDays className="nav-pill-icon" />
                <span>Events</span>
              </button>

              <button
                className="nav-pill"
                onClick={() => navigate("/leaderboard")}
              >
                <Trophy className="nav-pill-icon" />
                <span>Leaderboard</span>
              </button>

              {!userHasClub && (
                <button
                  className="nav-pill nav-pill-accent"
                  onClick={() => navigate("/create-club")}
                >
                  <PlusCircle className="nav-pill-icon" />
                  <span>Create Club</span>
                </button>
              )}
            </nav>
          </div>
        </header>

        {/* ---------------------- Club Grid ---------------------- */}

        <section className="clubs-grid-section">
          {filteredClubs.length === 0 && !loadingClubs && (
            <p className="clubs-empty">
              No clubs match your search.
            </p>
          )}

          <div className="clubs-grid">
            {filteredClubs.map((club) => (
              <Link
              key={club.id}
              to={`/club/${club.id}`}
              className={`club-card ${
                userClubId && String(club.rawId) === String(userClubId)
                  ? "club-card-own"
                  : ""
              }`}
            >
            
                <div className="club-card-image">
                  {isNewClub(club.createdAt) && (
                    <span className="club-pill-new">New</span>
                  )}

                  <img
                    src={club.image}
                    alt={club.name}
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src =
                        "https://via.placeholder.com/300x160?text=Club";
                    }}
                  />
                </div>

                <div className="club-card-body">
                  <h2 className="club-card-name">{club.name}</h2>
                  {club.meta?.location && (
                    <p className="club-card-meta">
                      {club.meta.location}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ------------------ Happening Soon ------------------ */}

        <section className="clubs-soon">
          <div className="clubs-soon-head">
            <h2 className="clubs-soon-title">Happening soon</h2>
            <Link to="/events" className="clubs-soon-link">
              See all
            </Link>
          </div>

          {loadingEvents ? (
            <p className="clubs-soon-empty">
              Loading upcoming events…
            </p>
          ) : !upcomingEvents.length ? (
            <p className="clubs-soon-empty">
              Events taking place soon will appear here.
            </p>
          ) : (
            <div className="clubs-soon-list">
              {upcomingEvents.slice(0, 6).map((ev) => (
                <Link
                  key={ev.id}
                  to={`/events/${ev.id}`}
                  className="clubs-soon-item"
                >
                  <div className="clubs-soon-thumb">
                    <img
                      src={ev.clubImage}
                      alt={ev.clubName}
                      onError={(e) => {
                        e.currentTarget.src =
                          "https://via.placeholder.com/300x160?text=Club";
                      }}
                    />
                  </div>

                  <div className="clubs-soon-info">
                    <div className="clubs-soon-row">
                      <span className="clubs-soon-club">
                        {ev.clubName}
                      </span>
                      <span className="clubs-soon-dot" />
                      <span className="clubs-soon-time">
                        {formatEventDateTime(ev.starts_at)}
                      </span>
                    </div>

                    <div className="clubs-soon-event-title">
                      {ev.title}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
