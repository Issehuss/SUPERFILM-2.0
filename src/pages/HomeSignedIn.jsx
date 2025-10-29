// src/pages/HomeSignedIn.jsx (SECURE TMDB + deck hover + auto-rotate + minimalist vertical watchlist w/ description + toggle button)
import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarClock,
  Film,
  Users,
  PlusCircle,
  ListChecks,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useUser } from "../context/UserContext";
import supabase from "../supabaseClient.js";
import useMyClubs from "../hooks/useMyClubs";
import useWatchlist from "../hooks/useWatchlist";
import LeaderboardWideCard from "../components/LeaderboardWideCard.jsx";
import { env as ENV } from "../lib/env";

/** Helper: format a date nicely */
function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

async function tmdbProxy(path, query = {}) {
  const cleanPath = String(path || "").startsWith("/") ? path : `/${path || ""}`;

  // 1) Supabase functions.invoke
  try {
    const { data, error } = await supabase.functions.invoke("tmdb-search", {
      body: { path: cleanPath, query },
      headers: { "Content-Type": "application/json" },
    });
    if (!error && data) return data;
    if (error) console.warn("[tmdbProxy] invoke error:", error.message || error);
  } catch (e) {
    console.warn("[tmdbProxy] invoke threw:", e?.message || e);
  }

  // 2) HTTP POST fallback
  if (ENV.SUPABASE_FUNCTIONS_URL) {
    try {
      const url = `${ENV.SUPABASE_FUNCTIONS_URL.replace(/\/$/, "")}/tmdb-search`;
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: cleanPath, query }),
      });
      if (r.ok) return await r.json();
      console.warn("[tmdbProxy] HTTP fallback non-2xx:", r.status, await r.text().catch(() => ""));
    } catch (e) {
      console.warn("[tmdbProxy] HTTP fallback threw:", e?.message || e);
    }
  }

  // 3) Direct TMDB
  const qs = new URLSearchParams(Object.entries(query || {})).toString();
  const apiUrl = `${ENV.TMDB_API_BASE || "https://api.themoviedb.org/3"}${cleanPath}${qs ? `?${qs}` : ""}`;

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

// helper: fetch last N rows from the view
async function fetchClubActivity(clubId, limit = 3) {
  const { data, error } = await supabase
    .from("recent_activity_v")
    .select("id, club_id, created_at, summary, actor_name, actor_avatar")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

const ENABLE_CURATIONS =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_ENABLE_CURATIONS === "true") || false;

export default function HomeSignedIn() {
  const { user, profile } = useUser();
  const navigate = useNavigate();

  // Active club
  const [club, setClub] = useState(null);

  // Activity + club
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [nextFromClub, setNextFromClub] = useState(null);

  // Film deck
  // Film deck
const [curated, setCurated] = useState([]);
const [nowPlaying, setNowPlaying] = useState([]);  // <- fix
const [deckIndex, setDeckIndex] = useState(0);
const [isDeckHover, setIsDeckHover] = useState(false);

  // Leaderboard
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);

  // Watchlist + clubs
  const { items: homeWatchlist, loading: wlLoading, add, remove } = useWatchlist(user?.id);
  const { clubs: myClubs } = useMyClubs(user?.id);

  // Choose active club
  useEffect(() => {
    setClub(myClubs?.[0] || null);
  }, [myClubs]);

  // Recent activity live
// Recent activity live
useEffect(() => {
  if (!club?.id) {
    setActivity([]);
    setActivityLoading(false);
    return;
  }

  let cancelled = false;
  let channel;

  (async () => {
    setActivityLoading(true);
    try {
      // 1️⃣ Initial fetch (last 5 events from your view)
      const rows = await fetchClubActivity(club.id, 5);
      if (!cancelled) setActivity(rows);
    } catch (e) {
      if (!cancelled) setActivity([]);
      console.warn("club activity (home) failed:", e);
    } finally {
      if (!cancelled) setActivityLoading(false);
    }

    // 2️⃣ Subscribe to live inserts for this club only
    channel = supabase
      .channel(`realtime:activity:club_${club.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity",
          filter: `club_id=eq.${club.id}`,
        },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          // Prepend the new item and keep max 5
          setActivity((prev) => [
            {
              id: row.id,
              summary: row.summary,
              created_at: row.created_at,
              actor_name: row.actor_name,
              actor_avatar: row.actor_avatar,
              club_id: row.club_id,
            },
            ...prev.slice(0, 4),
          ]);
        }
      )
      .subscribe();
  })();

  return () => {
    cancelled = true;
    if (channel) supabase.removeChannel(channel);
  };
}, [club?.id]);



  // Load essentials per club
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        if (club?.id) {
          const { data: cRow } = await supabase
            .from("clubs")
            .select("next_screening_title, slug, id")
            .eq("id", club.id)
            .maybeSingle();
          if (!cancelled) setNextFromClub(cRow?.next_screening_title || null);
        } else {
          if (!cancelled) setNextFromClub(null);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [user, club?.id]);

  // Curations (if enabled)
  useEffect(() => {
    if (!ENABLE_CURATIONS) {
      setCurated([]);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const { data } = await supabase
          .from("cinema_curations")
          .select("*")
          .eq("is_active", true)
          .eq("region", "GB")
          .lte("start_date", today)
          .gte("end_date", today)
          .order("order_index", { ascending: true });

        if (!mounted) return;

        if (data?.length) {
          const enriched = await Promise.all(
            data.map(async (row) => {
              let tmdb = {};
              try {
                const detail = await tmdbProxy(`/movie/${row.tmdb_id}`, { language: "en-GB" });
                tmdb = detail || {};
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
          setCurated(enriched);
          setDeckIndex(0);
        } else {
          setCurated([]);
        }
      } catch (e) {
        console.error("Curations fetch failed", e);
        setCurated([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [ENABLE_CURATIONS]);

  // TMDB Now Playing (proxy)
  useEffect(() => {
    if (ENABLE_CURATIONS && curated.length) return;
    (async () => {
      try {
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

        const list = (json?.results || [])
          .filter((m) => m.backdrop_path)
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

        const finalList =
          list.length > 0
            ? list
            : (json?.results || [])
                .filter((m) => m.backdrop_path)
                .slice(0, 10)
                .map((m) => ({
                  id: m.id,
                  title: m.title,
                  backdrop_path: m.backdrop_path,
                  release_date: m.release_date,
                  overview: m.overview || "",
                  poster_path: m.poster_path || null,
                }));

        setNowPlaying(finalList);
        setDeckIndex(0);
      } catch (e) {
        console.error("TMDB now_playing fetch (proxy) failed", e);
      }
    })();
  }, [ENABLE_CURATIONS, curated.length]);

  // Deck controls
  const nextDeck = useCallback(() => {
    setDeckIndex((i) => (nowPlaying.length ? (i + 1) % nowPlaying.length : 0));
  }, [nowPlaying.length]);

  const prevDeck = useCallback(() => {
    setDeckIndex((i) => (nowPlaying.length ? (i - 1 + nowPlaying.length) % nowPlaying.length : 0));
  }, [nowPlaying.length]);

  // Auto-rotate every ~2s (pause on hover; only if we have at least 3 items)
  useEffect(() => {
    if (isDeckHover) return;
    if (nowPlaying.length < 3) return;
    const t = setInterval(() => nextDeck(), 2000);
    return () => clearInterval(t);
  }, [isDeckHover, nowPlaying.length, nextDeck]);

  // Leaderboard (unchanged logic)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingLeaderboard(true);
      try {
        const { data: clubs } = await supabase
          .from("clubs")
          .select("id, name, banner_url")
          .limit(20);
        if (!clubs?.length) {
          setLeaderboard([]);
          setLoadingLeaderboard(false);
          return;
        }

        const rows = await Promise.all(
          clubs.map(async (c) => {
            const mem = await supabase
              .from("club_members")
              .select("*", { count: "exact", head: true })
              .eq("club_id", c.id);
            const members = mem?.count || 0;

            const now = new Date();
            const d30 = new Date();
            d30.setDate(now.getDate() - 30);
            const ev = await supabase
              .from("screenings")
              .select("*", { count: "exact", head: true })
              .eq("club_id", c.id)
              .gte("starts_at", d30.toISOString());
            const events30 = ev?.count || 0;

            const d7 = new Date();
            d7.setDate(now.getDate() - 7);
            const act = await supabase
              .from("activity")
              .select("*", { count: "exact", head: true })
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

        if (!mounted) return;
        rows.sort((a, b) => b.score - a.score);
        setLeaderboard(rows.slice(0, 10));
      } finally {
        if (mounted) setLoadingLeaderboard(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  /* ---------- Watchlist helpers (toggle) ---------- */
  async function addToWatchlist(movie) {
    if (!movie) return;
    const id = movie.id ?? movie.tmdb_id ?? movie.movie_id ?? movie?.data?.id ?? null;
    const title = movie.title ?? movie?.data?.title ?? "";
    const poster_path = movie.poster_path ?? movie?.data?.poster_path ?? movie.posterPath ?? "";
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

  // Watchlist lookup + current movie
  const watchlistIds = useMemo(
    () => new Set((homeWatchlist || []).map((m) => m.id ?? m.movie_id)),
    [homeWatchlist]
  );
  const currentMovie = nowPlaying[deckIndex] || null;
  const currentIsSaved = currentMovie ? watchlistIds.has(currentMovie.id) : false;

  // Display name
  const displayName =
    (profile?.display_name && profile.display_name.trim()) ||
    (user?.user_metadata?.full_name && user.user_metadata.full_name.trim()) ||
    (user?.user_metadata?.name && user.user_metadata.name.trim()) ||
    (user?.email ? user.email.split("@")[0] : "") ||
    "Filmmaker";

  /* ---------- Minimalist rotating Watchlist peek (taller, with description) ---------- */
  const [wlIndex, setWlIndex] = useState(0);
  const [wlMeta, setWlMeta] = useState({}); // { [id]: { overview, release_date } }

  // keep wlIndex in range when items change
  useEffect(() => {
    setWlIndex((i) => {
      if (!homeWatchlist?.length) return 0;
      return i % homeWatchlist.length;
    });
  }, [homeWatchlist?.length]);

  // auto-rotate every ~3s if >1 item
  useEffect(() => {
    if (!homeWatchlist || homeWatchlist.length <= 1) return;
    const t = setInterval(() => {
      setWlIndex((i) => (i + 1) % homeWatchlist.length);
    }, 3000);
    return () => clearInterval(t);
  }, [homeWatchlist]);

  const wlCurrent = homeWatchlist?.[wlIndex] || null;
  const wlId = wlCurrent ? (wlCurrent.id ?? wlCurrent.movie_id) : null;
  const wlPoster = wlCurrent?.poster_path
    ? (wlCurrent.poster_path.startsWith("http")
        ? wlCurrent.poster_path
        : `https://image.tmdb.org/t/p/w342${wlCurrent.poster_path}`)
    : null;

  // fetch TMDB details for wlCurrent (for overview) and cache
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
    return () => {
      ignore = true;
    };
  }, [wlId, wlMeta]);

  const wlOverview = wlId ? wlMeta[wlId]?.overview : "";
  const wlRelease = wlId ? wlMeta[wlId]?.release_date : null;

  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-8 text-white">
        {/* Welcome + Quick actions */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-400">Welcome back</p>
            <h1 className="text-2xl md:text-3xl font-bold">{displayName}</h1>
          </div>
          <div className="flex gap-2">
            <Link
              to="/movies"
              className="inline-flex items-center gap-2 rounded-full bg-yellow-500 px-4 py-2 text-black font-semibold hover:bg-yellow-400"
            >
              <PlusCircle size={18} /> Add to Watchlist
            </Link>
            <Link
              to={club ? `/clubs/${club.slug || club.id}` : "/clubs"}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 hover:bg-white/15"
            >
              <Users size={18} /> {club ? "Go to Club" : "Find a Club"}
            </Link>
          </div>
        </div>

        {/* ===================== */}
        {/* NOW IN CINEMAS (UK)  */}
        {/* ===================== */}
        <section className="mt-6 rounded-2xl bg-white/5 ring-1 ring-white/10 p-4 md:p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Film className="text-yellow-400" /> In Cinemas This Week
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={prevDeck} className="rounded-full bg-white/10 hover:bg-white/15 p-2">
                <ChevronLeft size={18} />
              </button>
              <button onClick={nextDeck} className="rounded-full bg-white/10 hover:bg-white/15 p-2">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div
            className="relative mt-4 h-[38vh] min-h-[300px] overflow-hidden"
            onMouseEnter={() => setIsDeckHover(true)}
            onMouseLeave={() => setIsDeckHover(false)}
          >
            {(() => {
              let items = nowPlaying;
              if (items.length === 1) items = [items[0], items[0], items[0]];
              else if (items.length === 2) items = [...items, ...items];

              const n = items.length;
              if (!n) return null;

              const prevIndex = (deckIndex - 1 + n) % n;
              const nextIndex = (deckIndex + 1) % n;
              const visible = [prevIndex, deckIndex, nextIndex];

              return visible.map((idx) => {
                const m = items[idx];
                if (!m) return null;

                const role = idx === deckIndex ? "center" : idx === prevIndex ? "left" : "right";

                const widthClass =
                  role === "center" ? "w-[74%] md:w-[72%] lg:w-[70%]" : "w-[50%] md:w-[46%] lg:w-[42%]";

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
                    key={`${m.id}-${role}`}
                    className={`group absolute top-1/2 left-1/2 ${widthClass} -translate-x-1/2 -translate-y-1/2 rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl backdrop-blur-sm bg-white/5`}
                    style={{
                      transform: baseTransform,
                      zIndex,
                      opacity,
                      filter: `blur(${blur}px)`,
                      transition: "transform 350ms ease, opacity 250ms ease, filter 250ms ease",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      if (role === "left") setDeckIndex(prevIndex);
                      else if (role === "right") setDeckIndex(nextIndex);
                      else navigate(`/movie/${m.id}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (role === "left") setDeckIndex(prevIndex);
                        else if (role === "right") setDeckIndex(nextIndex);
                        else navigate(`/movie/${m.id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={
                      role === "center"
                        ? `${m.title} — open details`
                        : role === "left"
                        ? `Show previous: ${items[prevIndex]?.title || ""}`
                        : `Show next: ${items[nextIndex]?.title || ""}`
                    }
                  >
                    {/* Inner scaler for “glass pop” */}
                    <div className="h-[38vh] min-h-[300px] w-full transition-transform duration-300 group-hover:scale-[1.03]">
                      {img ? (
                        <img
                          src={img}
                          alt={m.title}
                          className="block h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="h-full w-full bg-white/10" />
                      )}
                    </div>

                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/5" />
                  </div>
                );
              });
            })()}
          </div>

          {/* Actions + description */}
          {currentMovie && (
            <>
              <div className="mt-4 flex items-center justify-center gap-4 text-sm text-zinc-300">
                <span className="font-medium">{currentMovie.title}</span>
                {currentMovie.release_date && (
                  <span>• releases {new Date(currentMovie.release_date).toLocaleDateString()}</span>
                )}
                <button
                  onClick={() =>
                    currentIsSaved
                      ? removeFromWatchlist(currentMovie.id)
                      : addToWatchlist(currentMovie)
                  }
                  className={`px-3 py-1 rounded-full font-semibold ${
                    currentIsSaved
                      ? "bg-white/15 text-white hover:bg-white/20"
                      : "bg-yellow-500 text-black hover:bg-yellow-400"
                  }`}
                >
                  {currentIsSaved ? "Remove" : "Add to Watchlist"}
                </button>
                <button
                  onClick={() => navigate(`/movie/${currentMovie.id}`)}
                  className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/15"
                >
                  Open details
                </button>
              </div>
              {currentMovie.overview && (
                <p className="mt-2 max-w-3xl mx-auto text-center text-zinc-400 text-sm leading-relaxed">
                  {currentMovie.overview}
                </p>
              )}
            </>
          )}
        </section>

        {/* Grid sections */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Club */}
          <section className="col-span-1 lg:col-span-2 rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Film className="text-yellow-400" />
                <h2 className="text-xl font-semibold">{club ? club.name : "Join a Club"}</h2>
              </div>
              {club ? (
                <Link to={`/clubs/${club.slug || club.id}`} className="text-sm text-yellow-400 hover:underline">
                  Open
                </Link>
              ) : (
                <Link to="/clubs" className="text-sm text-yellow-400 hover:underline">
                  Browse clubs
                </Link>
              )}
            </div>

            <div className="relative w-full flex items-center justify-center py-10">
              {club?.profile_image_url ? (
                <img
                  src={club.profile_image_url}
                  alt={`${club.name} avatar`}
                  className="h-28 w-28 md:h-32 md:w-32 rounded-full object-cover ring-2 ring-white/20"
                />
              ) : (
                <div className="h-28 w-28 md:h-32 md:w-32 rounded-full bg-white/10 ring-2 ring-white/10" />
              )}
            </div>

            <div className="p-5 border-t border-white/10">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <CalendarClock size={18} /> Upcoming
              </h3>
              {nextFromClub ? (
                <p className="text-sm font-semibold text-yellow-400">{nextFromClub}</p>
              ) : (
                <p className="text-sm text-zinc-400">No screenings scheduled yet.</p>
              )}
            </div>
          </section>

          {/* Watchlist peek — same width, taller vertically, one poster + short description, auto-rotate */}
          <section className="col-span-1 rounded-2xl bg-white/5 ring-1 ring-white/10">
            <div className="p-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Your Watchlist</h2>
              <Link to="/profile" className="text-sm text-yellow-400 hover:underline">
                See all
              </Link>
            </div>

            <div className="p-5 pt-0">
              {wlLoading ? (
                <div className="h-[320px] md:h-[360px] rounded-xl bg-white/10 animate-pulse" />
              ) : !homeWatchlist?.length ? (
                <div className="h-[320px] md:h-[360px] rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-sm text-zinc-400">
                  Add films to your watchlist.
                </div>
              ) : (
                <div className="relative h-[320px] md:h-[360px] rounded-xl ring-1 ring-white/10 p-3">
                  <Link
                    to={`/movie/${wlCurrent?.id ?? wlCurrent?.movie_id}`}
                    className="flex h-full w-full flex-col items-center justify-start"
                    title={wlCurrent?.title || ""}
                    aria-label={wlCurrent?.title || "Watchlist item"}
                  >
                    {/* Poster area (kept proportional; not squashed) */}
                    <div className="flex-1 flex items-center justify-center w-full">
                      <div className="aspect-[2/3] h-[85%]">
                        {wlPoster ? (
                          <img
                            key={`${wlCurrent?.id || wlCurrent?.movie_id}-${wlIndex}`}
                            src={wlPoster}
                            alt={wlCurrent?.title || "Poster"}
                            className="h-full w-auto object-contain rounded-lg shadow-lg transition-opacity duration-500 opacity-100"
                            draggable={false}
                          />
                        ) : (
                          <div className="h-full w-full bg-white/10 rounded-lg" />
                        )}
                      </div>
                    </div>

                    {/* Title + tiny meta */}
                    <div className="mt-3 w-full text-center">
                      <div className="text-sm font-semibold line-clamp-1">{wlCurrent?.title || ""}</div>
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
          {/* Activity */}
<section className="col-span-1 lg:col-span-2 rounded-2xl bg-white/5 ring-1 ring-white/10">
  <div className="p-5 flex items-center justify-between">
    <h2 className="text-xl font-semibold">Recent Activity</h2>
    {club && (
      <Link to={`/clubs/${club.slug || club.id}`} className="text-sm text-yellow-400 hover:underline">
        Open club
      </Link>
    )}
  </div>

  {/* Loading skeleton */}
  {activityLoading && (
    <div className="px-5 pb-5 space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-white/10 animate-pulse" />
      ))}
    </div>
  )}

  {/* Empty / placeholder */}
  {!activityLoading && activity.length === 0 && (
    <div className="px-5 pb-5">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-zinc-300">
          See here what your clubs have been up to — messages, updates, and more will appear live.
        </p>
        <p className="text-xs text-zinc-500 mt-1">
          Tip: join a club or say hello in chat to get things started.
        </p>
      </div>
    </div>
  )}

  {/* Feed */}
  {!activityLoading && activity.length > 0 && (
    <ul className="divide-y divide-white/10">
      {activity.map((a) => (
        <li key={a.id} className="p-5 flex items-center gap-3">
          <img
            src={a.actor_avatar || "/avatar_placeholder.png"}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
          <div className="flex-1">
            <div className="text-sm">{a.summary}</div>
            <div className="text-xs text-zinc-500">{formatDateTime(a.created_at)}</div>
          </div>
        </li>
      ))}
    </ul>
  )}
</section>

        </div>

        {/* Leaderboard summary */}
        <div className="px-7 pt-7">
          <LeaderboardWideCard />
        </div>

        {/* Bottom Quick actions */}
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/movies"
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 hover:bg-white/15"
          >
            <ListChecks size={18} /> Log a film
          </Link>
          <Link
            to={club ? `/clubs/${club.slug || club.id}` : "/clubs"}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 hover:bg-white/15"
          >
            <Users size={18} /> {club ? "Post to club" : "Join a club"}
          </Link>
        </div>
      </div>
    </>
  );
}
