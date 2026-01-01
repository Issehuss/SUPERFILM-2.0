// src/pages/Movies.js
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";
import TmdbImage from "../components/TmdbImage";
import { toast } from "react-hot-toast";

// ─── 1) env + in-memory cache (module-level so it survives re-renders) ───
const TMDB_KEY =
  process.env.REACT_APP_TMDB_KEY || process.env.REACT_APP_TMDB_API_KEY || "";
const TMDB_CACHE = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h shared with HomeSignedIn
const NOW_PLAYING_CACHE_KEY = "tmdb:nowPlaying:GB:v2";

const readCache = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || !parsed?.data) return null;
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
};
const writeCache = (key, data) => {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {}
};

function Movies({ searchQuery = "" }) {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [nominating, setNominating] = useState({});
  const [nominatedIds, setNominatedIds] = useState(new Set());
  const { user } = useUser();

  // ─── 2) debounced + cached TMDB fetch ───
  useEffect(() => {
    if (!TMDB_KEY) {
      setMovies([]);
      setErr("TMDB key missing. Add REACT_APP_TMDB_KEY to .env.local");
      setLoading(false);
      return;
    }

    const q = (searchQuery || "").trim();
    const cacheKey = q || "__now_playing__";

    // serve from cache instantly if we have it
    if (TMDB_CACHE.has(cacheKey)) {
      setMovies(TMDB_CACHE.get(cacheKey));
      setLoading(false);
    } else {
      // allow cross-page session cache for the default now playing deck
      if (!q) {
        const cached = readCache(NOW_PLAYING_CACHE_KEY);
        if (cached?.list?.length) {
          TMDB_CACHE.set(cacheKey, cached.list);
          setMovies(cached.list);
          setLoading(false);
        } else {
          setLoading(true);
        }
      } else {
        setLoading(true);
      }
    }

    const controller = new AbortController();
    // debounced fetch — tighter for search, instant for now_playing
    const timer = setTimeout(async () => {
      try {
        const base = "https://api.themoviedb.org/3";
        const url = q
          ? `${base}/search/movie?api_key=${TMDB_KEY}&language=en-GB&query=${encodeURIComponent(
              q
            )}&page=1&include_adult=false`
          : `${base}/movie/now_playing?api_key=${TMDB_KEY}&language=en-GB&region=GB&page=1`;

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`TMDB ${res.status}: ${text.slice(0, 140)}`);
        }
        const data = await res.json();
        const list = Array.isArray(data.results) ? data.results : [];
        const sorted = list.sort(
          (a, b) => (b.popularity || 0) - (a.popularity || 0)
        );

        TMDB_CACHE.set(cacheKey, sorted);
        if (!q) {
          writeCache(NOW_PLAYING_CACHE_KEY, { list: sorted });
        }
        setMovies(sorted);
        setErr("");
      } catch (e) {
        if (e.name === "AbortError") return;
        console.warn("[Movies] fetch error:", e?.message);
        setErr("Couldn’t load movies from TMDB.");
        setMovies([]);
      } finally {
        setLoading(false);
      }
    }, q ? 350 : 0);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // ✅ Updated nominate helper with upsert (one vote per user)
  const handleNominate = async (movie, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const activeClubId = localStorage.getItem("activeClubId");
    if (!activeClubId) {
      alert("Open your club page first so I know which club to nominate for.");
      return;
    }
    if (!user?.id) {
      alert("Please sign in to nominate.");
      return;
    }

    setNominating((prev) => ({ ...prev, [movie.id]: true }));
    try {
      const { error } = await supabase
        .from("nominations")
        .upsert(
          {
            club_id: activeClubId,
            movie_id: movie.id,
            movie_title: movie.title || movie.name || "Untitled",
            poster_path: movie.poster_path || null,
            created_by: user.id,
          },
          { onConflict: ["club_id", "movie_id", "created_by"] }
        );

      if (error) {
        const msg = String(error.message || "").toLowerCase();
        if (msg.includes("policy")) {
          alert("You need to be a member of this club to nominate.");
        } else {
          alert(error.message || "Could not add nomination.");
        }
        return;
      }

      toast.success("Nominated!");
      setNominatedIds((prev) => {
        const next = new Set(prev);
        next.add(movie.id);
        return next;
      });
    } catch (e2) {
      alert(e2.message || "Could not add nomination.");
    } finally {
      setNominating((prev) => {
        const next = { ...prev };
        delete next[movie.id];
        return next;
      });
    }
  };

  const handleUnnominate = async (movie, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const activeClubId = localStorage.getItem("activeClubId");
    if (!activeClubId) {
      alert("Open your club page first so I know which club to un-nominate from.");
      return;
    }
    if (!user?.id) {
      alert("Please sign in to manage nominations.");
      return;
    }

    setNominating((prev) => ({ ...prev, [movie.id]: true }));
    try {
      const { error } = await supabase
        .from("nominations")
        .delete()
        .eq("club_id", activeClubId)
        .eq("movie_id", movie.id)
        .eq("created_by", user.id);

      if (error) {
        alert(error.message || "Could not remove nomination.");
        return;
      }

      toast.success("Nomination removed");
      setNominatedIds((prev) => {
        const next = new Set(prev);
        next.delete(movie.id);
        return next;
      });
    } catch (e2) {
      alert(e2.message || "Could not remove nomination.");
    } finally {
      setNominating((prev) => {
        const next = { ...prev };
        delete next[movie.id];
        return next;
      });
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-yellow-400">
          {searchQuery?.trim()
            ? `Search Results for "${searchQuery.trim()}"`
            : "Now Playing in Cinemas"}
        </h2>
      </div>

      {loading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="h-72 rounded-lg bg-zinc-900/60 ring-1 ring-zinc-800 animate-pulse"
            />
          ))}
        </div>
      )}

      {!loading && err && (
        <p className="text-center text-zinc-400">{err}</p>
      )}

      {!loading && !err && movies.length === 0 && (
        <p className="text-center text-zinc-400">No movies found.</p>
      )}

      {!loading && !err && movies.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
          {movies.map((movie) => {
            const isBusy = !!nominating[movie.id];
            return (
              <Link
                to={`/movie/${movie.id}`}
                key={movie.id}
                className="relative overflow-hidden rounded-lg transform hover:scale-105 transition-transform duration-300 hover:ring-2 hover:ring-yellow-400"
              >
                {movie.poster_path ? (
                  <TmdbImage
                    src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                    alt={movie.title}
                    className="w-full h-72 aspect-[2/3]"
                    imgClassName="rounded-lg"
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-72 flex items-center justify-center bg-zinc-800 text-zinc-400">
                    No Image
                  </div>
                )}

                {/* Nominate button */}
              <button
                onClick={(e) =>
                  nominatedIds.has(movie.id)
                    ? handleUnnominate(movie, e)
                    : handleNominate(movie, e)
                }
                disabled={isBusy}
                className={`absolute left-2 bottom-2 text-xs px-2 py-1 rounded ${
                  nominatedIds.has(movie.id)
                    ? "bg-red-500 text-black hover:bg-red-400"
                    : "bg-yellow-500 text-black hover:bg-yellow-400"
                } disabled:opacity-60`}
                title={
                  nominatedIds.has(movie.id)
                    ? "Remove your nomination for this film"
                    : "Nominate this film for your active club"
                }
              >
                {isBusy
                  ? nominatedIds.has(movie.id)
                    ? "Removing…"
                    : "Adding…"
                  : nominatedIds.has(movie.id)
                  ? "Un Nominate"
                  : "Nominate"}
              </button>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Movies;
