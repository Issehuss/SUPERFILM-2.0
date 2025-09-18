// src/pages/HomeSignedIn.jsx
import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  Film,
  Users,
  PlusCircle,
  // Ticket, // <- removed (unused)
  ListChecks,
  ChevronLeft,
  ChevronRight,
  Crown,
} from "lucide-react";
import { useUser } from "../context/UserContext";
import supabase from "../supabaseClient.js";
import useMyClubs from "../hooks/useMyClubs";
import useWatchlist from "../hooks/useWatchlist";
import WatchlistCarousel from "../components/WatchlistCarousel";

/** -------- ENV (works in CRA and Vite) -------- */
const TMDB_KEY =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    import.meta.env.VITE_TMDB_API_KEY) ||
  process.env.REACT_APP_TMDB_API_KEY;

/** Helper: format a date nicely */
function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// helper: fetch last N rows from the view
async function fetchClubActivity(clubId, limit = 3) {
  const { data, error } = await supabase
    .from("recent_activity_v") // <- the view you created
    .select("id, club_id, created_at, summary, actor_name, actor_avatar")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export default function HomeSignedIn() {
  const { user } = useUser();

  // ✅ Pull ALL clubs the user has joined
  const { clubs: myClubs } = useMyClubs(user?.id);

  // The club we feature on this page (first one for now)
  const [club, setClub] = useState(null);

  const [upcoming, setUpcoming] = useState([]); // (left as-is if you use later)
  const [activity, setActivity] = useState([]);
  const [matches, setMatches] = useState([]); // (left as-is if you use later)
  const [nextFromClub, setNextFromClub] = useState(null);

  // NOW IN CINEMAS (deck)
  const [curated, setCurated] = useState([]); // curated rows for this week
  const [nowPlaying, setNowPlaying] = useState([]); // deck items to render
  const [deckIndex, setDeckIndex] = useState(0);

  // Club Leaderboard
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  // ✅ Hook into watchlist (for the peek section)
const { items: homeWatchlist, loading: wlLoading } = useWatchlist(user?.id);


  // Old helper (kept if you reuse elsewhere)
  async function fetchClubActivityRows(clubId, limit = 3) {
    const { data, error } = await supabase
      .from("recent_activity")
      .select("id, club_id, created_at, summary, actor_name, actor_avatar")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      summary: row.summary ?? "",
      created_at: row.created_at,
      actor_name: row.actor_name ?? "",
      actor_avatar: row.actor_avatar ?? "",
    }));
  }

  /* -------------------------
    Choose active club from myClubs
  ------------------------- */
  useEffect(() => {
    setClub(myClubs?.[0] || null);
  }, [myClubs]);

  // Last 3 activity items for the currently selected club
// Load last N activity rows for the currently selected club (same as club profile)
useEffect(() => {
  if (!club?.id) {
    setActivity([]);
    return;
  }

  let cancelled = false;

  (async () => {
    try {
      const rows = await fetchClubActivity(club.id, 5); // show 5 items on home
      if (!cancelled) setActivity(rows);
    } catch (e) {
      if (!cancelled) setActivity([]);
      console.warn("club activity (home) failed:", e);
    }
  })();

  // Optional: realtime push on INSERTs into the underlying table
  const channel = supabase
    .channel(`club-activity:${club.id}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "activity", filter: `club_id=eq.${club.id}` },
      (payload) => {
        // Map to the view shape as best as possible
        const row = payload?.new || {};
        setActivity((prev) => [
          {
            id: row.id,
            summary: row.summary ?? "",
            created_at: row.created_at,
            actor_name: row.actor_name ?? "",
            actor_avatar: row.actor_avatar ?? "",
            club_id: row.club_id,
          },
          ...prev,
        ].slice(0, 5));
      }
    )
    .subscribe();

  return () => {
    cancelled = true;
    try { supabase.removeChannel(channel); } catch {}
  };
}, [club?.id]);


  /* -------------------------
    Load essentials (based on active club)
  ------------------------- */
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        // A) Next screening *from clubs table ticket fields*
        if (club?.id) {
          const { data: cRow } = await supabase
            .from("clubs")
            .select(
              "next_screening_title, next_screening_at, next_screening_location, slug, id"
            )
            .eq("id", club.id)
            .maybeSingle();

          if (!cancelled) setNextFromClub(cRow?.next_screening_title || null);
        } else {
          if (!cancelled) setNextFromClub(null);
        }

        // ⛔️ B) Watchlist peek — removed (old table / duplicate source)

        // C) Recent activity (top 3 from view)
        if (club?.id) {
          try {
            const rows = await fetchClubActivity(club.id, 3);
            setActivity(rows);
          } catch {
            setActivity([]);
          }
        } else {
          setActivity([]);
        }

        // D) Taste matches
        const { data: tm } = await supabase
          .from("taste_matches_view")
          .select("other_user_id, other_user_name, other_user_avatar, score")
          .eq("user_id", user.id)
          .order("score", { ascending: false })
          .limit(4);

        if (!cancelled) {
          setMatches(
            (tm || []).map((m) => ({
              userId: m.other_user_id,
              name: m.other_user_name,
              avatar: m.other_user_avatar,
              match: m.score,
            }))
          );
        }
      } catch {
        // swallow errors for this dashboard fetch pass
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, club?.id]);

  /* --------------------------------------------------------
    PART 2: Curated list via Supabase (takes priority)
  -------------------------------------------------------- */
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
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
          // Enrich from TMDB if needed, but honor full URL overrides exactly
          const enriched = await Promise.all(
            data.map(async (row) => {
              let tmdb = {};
              try {
                if (TMDB_KEY) {
                  const r = await fetch(
                    `https://api.themoviedb.org/3/movie/${row.tmdb_id}?language=en-GB&api_key=${TMDB_KEY}`
                  );
                  tmdb = await r.json();
                }
              } catch {
                // ignore
              }

              const override =
                row.backdrop_override && row.backdrop_override.trim();

              // Prefer: override (full URL or TMDB path) → TMDB backdrop → TMDB poster
              const chosenBackdrop =
                override || tmdb.backdrop_path || tmdb.poster_path || null;

              return {
                id: row.tmdb_id,
                title: row.title_override || tmdb.title || "",
                backdrop_path: chosenBackdrop, // may be full URL or TMDB path
                release_date: tmdb.release_date || null,
                overview: row.description || tmdb.overview || "",
                poster_path: tmdb.poster_path || null, // kept for fallback
              };
            })
          );

          setCurated(enriched);
          setNowPlaying(enriched); // curated wins
          setDeckIndex(0);
        } else {
          setCurated([]);
        }
      } catch (e) {
        console.error("Curations fetch failed", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  /* --------------------------------------------------------
    PART 1: TMDB fallback (only if no curated rows today)
  -------------------------------------------------------- */
  useEffect(() => {
    if (!TMDB_KEY) return;
    if (curated.length) return; // curated takes priority

    (async () => {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/movie/now_playing?language=en-GB&region=GB&page=1&api_key=${TMDB_KEY}`
        );
        const json = await res.json();

        const today = new Date();
        const minus14 = new Date(today);
        minus14.setDate(today.getDate() - 14);
        const plus7 = new Date(today);
        plus7.setDate(today.getDate() + 7);

        const list = (json?.results || [])
          .filter((m) => m.backdrop_path) // we want nice wide stills
          .filter((m) => {
            const d = new Date(m.release_date || today);
            return d >= minus14 && d <= plus7;
          })
          .map((m) => ({
            id: m.id,
            title: m.title,
            backdrop_path: m.backdrop_path, // TMDB path
            release_date: m.release_date,
            overview: m.overview || "",
            poster_path: m.poster_path || null,
          }));

        const finalList = list.length
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
        console.error("TMDB now_playing fetch failed", e);
      }
    })();
  }, [curated.length]);

  /* -------- Deck controls -------- */
  const nextDeck = useCallback(() => {
    setDeckIndex((i) => (nowPlaying.length ? (i + 1) % nowPlaying.length : 0));
  }, [nowPlaying.length]);
  const prevDeck = useCallback(() => {
    setDeckIndex((i) => (nowPlaying.length ? (i - 1 + nowPlaying.length) % nowPlaying.length : 0));
  }, [nowPlaying.length]);

  /* ---- Leaderboard (unchanged logic, but banner_url) ---- */
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

  /* -------- Add-to-watchlist (uses Supabase via hook) -------- */
  const { add } = useWatchlist(); // signed-in user's watchlist
  async function addToWatchlist(movie) {
    if (!movie) return;
    const id =
      movie.id ?? movie.tmdb_id ?? movie.movie_id ?? movie?.data?.id ?? null;
    const title = movie.title ?? movie?.data?.title ?? "";
    const poster_path =
      movie.poster_path ?? movie?.data?.poster_path ?? movie.posterPath ?? "";

    if (!id) return;
    const res = await add({ id: Number(id), title, poster_path });
    if (res?.error) {
      console.warn("[HomeSignedIn] addToWatchlist failed:", res.error);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 md:px-6 py-8 text-white">
      {/* Welcome + Quick actions */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-400">Welcome back</p>
          <h1 className="text-2xl md:text-3xl font-bold">
            {user.user_metadata?.name || "Filmmaker"}
          </h1>
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
            <button
              onClick={prevDeck}
              className="rounded-full bg-white/10 hover:bg-white/15 p-2"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={nextDeck}
              className="rounded-full bg-white/10 hover:bg-white/15 p-2"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="relative mt-4 h-[38vh] min-h-[300px] overflow-hidden">
  {(() => {
    // Ensure we always have at least 3 items to render (duplicate if needed)
    let items = nowPlaying;

    if (items.length === 1) {
      items = [items[0], items[0], items[0]];
    } else if (items.length === 2) {
      items = [...items, ...items]; // 4 items; fine for prev/center/next
    }

    const n = items.length;
    if (!n) return null;

    const prevIndex = (deckIndex - 1 + n) % n;
    const nextIndex = (deckIndex + 1) % n;

    // Always render three cards: left • center • right
    const visible = [prevIndex, deckIndex, nextIndex];

    return visible.map((idx) => {
      const m = items[idx];
      if (!m) return null;

      const role =
        idx === deckIndex ? "center" : idx === prevIndex ? "left" : "right";

      const widthClass =
        role === "center"
          ? "w-[74%] md:w-[72%] lg:w-[70%]"
          : "w-[50%] md:w-[46%] lg:w-[42%]";

      const transform =
        role === "center"
          ? "translate(-50%, -50%) scale(1)"
          : role === "left"
          ? "translate(-115%, -50%) scale(0.92)"
          : "translate(15%, -50%) scale(0.92)";

      const zIndex = role === "center" ? 30 : 20;
      const opacity = role === "center" ? 1 : 0.8;
      const blur = role === "center" ? 0 : 1.2;

      // Build image URL from full URL or TMDB path
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
          className={`absolute top-1/2 left-1/2 ${widthClass} -translate-x-1/2 -translate-y-1/2 rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl`}
          style={{
            transform,
            zIndex,
            opacity,
            filter: `blur(${blur}px)`,
            transition:
              "transform 350ms ease, opacity 250ms ease, filter 250ms ease",
            cursor: role === "center" ? "default" : "pointer",
            background: !img ? "rgba(255,255,255,0.05)" : undefined,
          }}
          onClick={() => {
            if (role === "left") setDeckIndex(prevIndex);
            if (role === "right") setDeckIndex(nextIndex);
          }}
        >
          {img ? (
            <img
              src={img}
              alt={m.title}
              className="block h-[38vh] min-h-[300px] w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="h-[38vh] min-h-[300px] w-full bg-white/5" />
          )}
        </div>
      );
    });
  })()}
</div>


        {/* Minimal actions + description BELOW the images (keep stills unobstructed) */}
        {nowPlaying[deckIndex] && (
          <>
            <div className="mt-4 flex items-center justify-center gap-4 text-sm text-zinc-300">
              <span className="font-medium">{nowPlaying[deckIndex].title}</span>
              {nowPlaying[deckIndex].release_date && (
                <span>
                  • releases{" "}
                  {new Date(
                    nowPlaying[deckIndex].release_date
                  ).toLocaleDateString()}
                </span>
              )}
              <button
                onClick={() => addToWatchlist(nowPlaying[deckIndex])}
                className="px-3 py-1 rounded-full bg-yellow-500 text-black font-semibold hover:bg-yellow-400"
              >
                Add to Watchlist
              </button>
            </div>
            {nowPlaying[deckIndex]?.overview && (
              <p className="mt-2 max-w-3xl mx-auto text-center text-zinc-400 text-sm leading-relaxed">
                {nowPlaying[deckIndex].overview}
              </p>
            )}
          </>
        )}

        {!TMDB_KEY && !curated.length && (
          <p className="mt-3 text-sm text-zinc-400">
            Add <code>REACT_APP_TMDB_API_KEY</code> to <code>.env.local</code>{" "}
            and restart to load films automatically, or add rows to{" "}
            <code>cinema_curations</code> to curate this section.
          </p>
        )}
      </section>

      {/* Existing grid layout */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Your Club / Join a Club */}
        <section className="col-span-1 lg:col-span-2 rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Film className="text-yellow-400" />
              <h2 className="text-xl font-semibold">
                {club ? club.name : "Join a Club"}
              </h2>
            </div>
            {club ? (
              <Link
                to={`/clubs/${club.slug || club.id}`}
                className="text-sm text-yellow-400 hover:underline"
              >
                Open
              </Link>
            ) : (
              <Link
                to="/clubs"
                className="text-sm text-yellow-400 hover:underline"
              >
                Browse clubs
              </Link>
            )}
          </div>

          {/* Club avatar / placeholder */}
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

          {/* Upcoming screening (simplified: just film title) */}
          <div className="p-5 border-t border-white/10">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <CalendarClock size={18} /> Upcoming
            </h3>
            {nextFromClub ? (
              <p className="text-sm font-semibold text-yellow-400">
                {nextFromClub}
              </p>
            ) : (
              <p className="text-sm text-zinc-400">No screenings scheduled yet.</p>
            )}
          </div>
        </section>

        {/* Watchlist peek (uses the same DB as Profile via useWatchlist) */}
      {/* Watchlist peek */}
<section className="col-span-1 rounded-2xl bg-white/5 ring-1 ring-white/10">
  <div className="p-5 flex items-center justify-between">
    <h2 className="text-xl font-semibold">Your Watchlist</h2>
    <Link to="/profile" className="text-sm text-yellow-400 hover:underline">
      See all
    </Link>
  </div>

  <div className="p-5 pt-0">
    {wlLoading ? (
      <div className="h-[220px] rounded-xl bg-white/10 animate-pulse" />
    ) : !homeWatchlist?.length ? (
      <div className="text-sm text-zinc-400">Add films to your watchlist.</div>
    ) : (
      <div className="h-[220px]">
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pr-1 scrollbar-thin scrollbar-thumb-white/10">
          {homeWatchlist.map((m) => {
            const id = m.id ?? m.movie_id;
            return (
              <Link
                key={id}
                to={`/movie/${id}`}
                className="snap-start shrink-0 w-[140px] h-full rounded-xl overflow-hidden ring-1 ring-white/10 group"
                title={m.title}
              >
                <img
                  src={
                    m.poster_path?.startsWith("http")
                      ? m.poster_path
                      : `https://image.tmdb.org/t/p/w342${m.poster_path}`
                  }
                  alt={m.title || "Poster"}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </Link>
            );
          })}
        </div>
      </div>
    )}
  </div>
</section>

        {/* Activity feed */}
        <section className="col-span-1 lg:col-span-2 rounded-2xl bg-white/5 ring-1 ring-white/10">
          <div className="p-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Club Recent Activity</h2>
            {club && (
              <Link
                to={`/clubs/${club.slug || club.id}`}
                className="text-sm text-yellow-400 hover:underline"
              >
                Open club
              </Link>
            )}
          </div>
          <ul className="divide-y divide-white/10">
            {activity.length ? (
              activity.map((a) => (
                <li key={a.id} className="p-5 flex items-center gap-3">
                  <img
                    src={a.actor_avatar || "/avatar_placeholder.png"}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <div className="text-sm">{a.summary}</div>
                    <div className="text-xs text-zinc-500">
                      {formatDateTime(a.created_at)}
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li className="p-5 text-sm text-zinc-400">No activity yet.</li>
            )}
          </ul>
        </section>
      </div>

      {/* ================== */}
      {/* CLUB LEADERBOARD   */}
      {/* ================== */}
      <section className="mt-6 rounded-2xl bg-white/5 ring-1 ring-white/10 overflow-hidden">
        <div className="p-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Crown className="text-yellow-400" /> Club Leaderboard
          </h2>
          <span className="text-xs text-zinc-400">
            Score = members×3 + events(30d)×4 + activity(7d)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5 text-zinc-300">
              <tr>
                <th className="text-left px-5 py-3">Rank</th>
                <th className="text-left px-5 py-3">Club</th>
                <th className="text-left px-5 py-3">Members</th>
                <th className="text-left px-5 py-3">Events (30d)</th>
                <th className="text-left px-5 py-3">Activity (7d)</th>
                <th className="text-left px-5 py-3">Score</th>
                <th className="text-right px-5 py-3">Open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loadingLeaderboard ? (
                <tr>
                  <td className="px-5 py-4 text-zinc-400" colSpan={7}>
                    Loading…
                  </td>
                </tr>
              ) : leaderboard.length ? (
                leaderboard.map((c, idx) => (
                  <tr key={c.id} className={idx < 3 ? "bg-white/[0.03]" : ""}>
                    <td className="px-5 py-4 font-semibold">
                      {idx === 0
                        ? "🥇"
                        : idx === 1
                        ? "🥈"
                        : idx === 2
                        ? "🥉"
                        : idx + 1}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-14 rounded object-cover overflow-hidden bg-white/10">
                          {c.banner_url ? (
                            <img
                              src={c.banner_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">{c.members}</td>
                    <td className="px-5 py-4">{c.events30}</td>
                    <td className="px-5 py-4">{c.activity7}</td>
                    <td className="px-5 py-4 font-semibold">{c.score}</td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        to={`/clubs/${c.id}`}
                        className="text-yellow-400 hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-5 py-4 text-zinc-400" colSpan={7}>
                    No clubs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

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
  );
}
