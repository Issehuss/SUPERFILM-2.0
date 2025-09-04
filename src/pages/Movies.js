// src/pages/Movies.js
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";

function Movies({ searchQuery = "" }) {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [nominating, setNominating] = useState(new Set());

  const { user } = useUser();

  const TMDB_KEY =
    process.env.REACT_APP_TMDB_KEY || process.env.REACT_APP_TMDB_API_KEY;

  useEffect(() => {
    let cancelled = false;

    async function fetchMovies() {
      setLoading(true);
      setErr("");
      try {
        if (!TMDB_KEY) {
          setMovies([]);
          setErr("TMDB key missing. Add REACT_APP_TMDB_KEY to .env.local");
          return;
        }

        const q = (searchQuery || "").trim();
        const base = "https://api.themoviedb.org/3";
        const url = q
          ? `${base}/search/movie?api_key=${TMDB_KEY}&language=en-GB&query=${encodeURIComponent(
              q
            )}&page=1&include_adult=false`
          : `${base}/movie/now_playing?api_key=${TMDB_KEY}&language=en-GB&region=GB&page=1`;

        const res = await fetch(url);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`TMDB ${res.status}: ${text.slice(0, 200)}`);
        }
        const data = await res.json();
        const list = Array.isArray(data.results) ? data.results : [];
        const sorted = list.sort(
          (a, b) => (b.popularity || 0) - (a.popularity || 0)
        );

        if (!cancelled) setMovies(sorted);
      } catch (e) {
        console.warn("[Movies] fetch error:", e?.message);
        if (!cancelled) {
          setMovies([]);
          setErr("Couldn’t load movies from TMDB.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMovies();
    return () => {
      cancelled = true;
    };
  }, [searchQuery, TMDB_KEY]);

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

    setNominating((prev) => new Set(prev).add(movie.id));
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
          { onConflict: ["club_id", "movie_id", "created_by"] } // ✅ prevents duplicates
        );

      if (error) {
        const msg = String(error.message || "").toLowerCase();
        if (msg.includes("policy")) {
          alert("You need to be a member of this club to nominate.");
        } else {
          alert(error.message || "Could not add nomination.");
        }
      }
    } catch (e2) {
      alert(e2.message || "Could not add nomination.");
    } finally {
      setNominating((prev) => {
        const next = new Set(prev);
        next.delete(movie.id);
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
            const isBusy = nominating.has(movie.id);
            return (
              <Link
                to={`/movie/${movie.id}`}
                key={movie.id}
                className="relative overflow-hidden rounded-lg transform hover:scale-105 transition-transform duration-300 hover:ring-2 hover:ring-yellow-400"
              >
                {movie.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                    alt={movie.title}
                    className="w-full h-72 object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-72 flex items-center justify-center bg-zinc-800 text-zinc-400">
                    No Image
                  </div>
                )}

                {/* Nominate button */}
                <button
                  onClick={(e) => handleNominate(movie, e)}
                  disabled={isBusy}
                  className="absolute left-2 bottom-2 text-xs px-2 py-1 rounded bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-60"
                  title="Nominate this film for your active club"
                >
                  {isBusy ? "Adding…" : "Nominate"}
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
