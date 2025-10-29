// src/pages/MovieDetails.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { nominateMovie } from "../lib/nominations";
import { useUser } from "../context/UserContext";
import useWatchlist from "../hooks/useWatchlist";
import supabase from "../supabaseClient";
import { env } from "../lib/env";

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INT_RX = /^\d+$/;

function MovieDetails() {
  const params = useParams();
  // Be flexible with param names (covers /movie/:id, /movies/:id, etc.)
  const rawParam = params.id || params.movieId || params.movieParam;
  const clubId = params.clubId || null;

  const { user } = useUser();
  const { items, add, remove } = useWatchlist();

  const [movie, setMovie] = useState(null);
  const [cast, setCast] = useState([]);
  const [watchProviders, setWatchProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [watchlisted, setWatchlisted] = useState(false);
  const [showingInfo, setShowingInfo] = useState(false);

  const providerLinks = {
    Netflix: "https://www.netflix.com",
    "Amazon Prime Video": "https://www.primevideo.com",
    "Disney Plus": "https://www.disneyplus.com",
    Hulu: "https://www.hulu.com",
    "Apple TV": "https://tv.apple.com",
    "Paramount Plus": "https://www.paramountplus.com",
    Peacock: "https://www.peacocktv.com",
  };

  // ---- Helpers ----
  // Resolve URL param → TMDB numeric id (supports UUID or slug via your DB)
  async function resolveTmdbId(param) {
    if (!param) return null;
    if (INT_RX.test(String(param))) return Number(param); // already TMDB id

    if (UUID_RX.test(String(param))) {
      const { data, error } = await supabase
        .from("movies")
        .select("tmdb_id")
        .eq("id", param)
        .maybeSingle();
      if (error) console.warn("[MovieDetails] movies by id lookup failed:", error);
      return data?.tmdb_id || null;
    }

    // treat as slug
    const { data, error } = await supabase
      .from("movies")
      .select("tmdb_id")
      .eq("slug", param)
      .maybeSingle();
    if (error) console.warn("[MovieDetails] movies by slug lookup failed:", error);
    return data?.tmdb_id || null;
  }

  // Call TMDB via Edge Function; fallback to direct TMDB if EF returns non-2xx
  async function tmdb(path, query = {}) {
    // 1) Try proxy (Edge Function)
    try {
      const { data, error } = await supabase.functions.invoke("tmdb-search", {
        body: { path, query },
      });
      if (error) throw error;
      return data || {};
    } catch (e) {
      console.warn("[tmdb-search] proxy failed; falling back to direct TMDB:", e);
      // 2) Fallback to direct TMDB (browser) — needs REACT_APP_TMDB_KEY in .env(.local)
      const key = env.TMDB_API_KEY;
      if (!key) throw new Error("TMDB key missing. Add REACT_APP_TMDB_KEY to .env.local");

      const base = env.TMDB_API_BASE || "https://api.themoviedb.org/3";
      const url = new URL(base + (path.startsWith("/") ? path : `/${path}`));
      // attach query
      for (const [k, v] of Object.entries(query || {})) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
      url.searchParams.set("api_key", key);

      const res = await fetch(url.toString());
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`TMDB HTTP ${res.status}: ${text}`);
      }
      return await res.json();
    }
  }

  // ---- Load movie details ----
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setMovie(null);
      setCast([]);
      setWatchProviders([]);

      try {
        const tmdbId = await resolveTmdbId(rawParam);
        if (!tmdbId) {
          if (!cancelled) setMovie(null);
          return;
        }

        const [movieData, creditsData, providerData] = await Promise.all([
          tmdb(`/movie/${tmdbId}`, { language: "en-GB" }),
          tmdb(`/movie/${tmdbId}/credits`, { language: "en-GB" }),
          tmdb(`/movie/${tmdbId}/watch/providers`),
        ]);

        if (cancelled) return;

        setMovie(movieData);
        setCast((creditsData?.cast || []).slice(0, 5));
        const region = providerData?.results?.GB || providerData?.results?.US || {};
        setWatchProviders(region?.flatrate || []);
      } catch (error) {
        console.error("[MovieDetails] TMDB load failed:", error);
        if (!cancelled) setMovie(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rawParam]);

  // ---- Watchlist sync ----
  useEffect(() => {
    if (!movie) return;
    const isInWatchlist = items.some((m) => m.id === movie.id);
    setWatchlisted(isInWatchlist);
  }, [items, movie]);

  const toggleWatchlist = async () => {
    if (!movie) return;
    if (watchlisted) {
      const res = await remove(movie.id);
      if (res?.error) console.warn("[watchlist] remove failed:", res.error);
    } else {
      const res = await add({
        id: movie.id,
        title: movie.title,
        poster_path: movie.poster_path,
      });
      if (res?.error) console.warn("[watchlist] add failed:", res.error);
    }
  };

  // ---- Nominate ----
  async function handleNominate() {
    if (!movie) return;
    setConfirmed(true); // optimistic UI

    const res = await nominateMovie({
      clubId,
      userId: user?.id || null,
      movie: { id: movie.id, title: movie.title, poster_path: movie.poster_path },
    });

    if (!res.ok) {
      console.error("[Nominate] error:", res.error);
      alert("Could not nominate this film. Please try again.");
      setConfirmed(false);
    } else if (res.fallback) {
      console.log("Nomination saved locally (no club/auth).");
    }
  }

  // ---- UI ----
  if (loading) return <p className="text-center text-zinc-400">Loading movie details...</p>;
  if (!movie) return <p className="text-center text-zinc-400">Movie not found.</p>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row gap-8">
        <img
          src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
          alt={movie.title}
          className="w-full md:w-64 rounded-2xl shadow-lg"
        />

        <div>
          <h2 className="text-3xl font-bold mb-2">{movie.title}</h2>
          <p className="text-sm text-zinc-400 mb-4">Release Date: {movie.release_date}</p>
          <p className="text-zinc-200 mb-6">{movie.overview}</p>
          <p className="text-sm text-zinc-400">Runtime: {movie.runtime} minutes</p>
          <p className="text-sm text-zinc-400 mt-2">Rating: {movie.vote_average}/10</p>

          {/* Cast */}
          <div className="mt-6">
            <h3 className="text-xl font-semibold text-yellow-400 mb-2">Cast</h3>
            <ul className="list-disc list-inside text-zinc-300">
              {cast.map((actor) => (
                <li key={actor.cast_id || actor.credit_id || actor.id}>
                  {actor.name} {actor.character ? <>as {actor.character}</> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Yellow Action Cards */}
      <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 w-full">
        {/* Next Screening (Nominate) */}
        <div className="bg-yellow-400 text-black px-10 py-20 rounded-2xl shadow-lg text-center min-h-[400px] flex flex-col items-center transform transition-transform duration-300 hover:scale-105">
          <h3 className="text-3xl font-bold mb-6">Next Screening?</h3>
          <p className="text-lg leading-relaxed max-w-xs mb-6">
            Would you like to nominate this film for your club&apos;s next event?
          </p>
          <button
            onClick={handleNominate}
            className={`transition-all duration-300 flex items-center justify-center ${
              confirmed ? "w-12 h-12 rounded-full bg-black" : "px-6 py-2 rounded-full bg-black"
            }`}
          >
            {confirmed ? <Check className="text-yellow-400 w-6 h-6" /> : <span className="text-yellow-400 font-semibold">Yes</span>}
          </button>
          {confirmed && (
            <p className="mt-3 text-xs text-black/80">
              Nominated! It will appear on your club page under Nominations.
            </p>
          )}
        </div>

        {/* Where to Watch */}
        <div className="bg-yellow-400 text-black px-10 py-20 rounded-2xl shadow-lg text-center min-h-[400px] flex flex-col items-center transform transition-transform duration-300 hover:scale-105">
          <h3 className="text-3xl font-bold mb-6">Where to Watch</h3>
          {watchProviders.length > 0 && (
            <div className="flex flex-wrap gap-4 justify-center mb-6">
              {watchProviders.map((provider, index) => (
                <a
                  key={index}
                  href={providerLinks[provider.provider_name] || `https://www.google.com/search?q=${provider.provider_name}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 rounded-lg bg-white flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                >
                  <img
                    src={`https://image.tmdb.org/t/p/original${provider.logo_path}`}
                    alt={provider.provider_name}
                    className="w-8 h-8 object-contain"
                  />
                </a>
              ))}
            </div>
          )}
          <button
            onClick={() =>
              setShowingInfo(true) ||
              window.open(`https://www.google.com/search?q=${movie.title} showtimes near me`, "_blank")
            }
            className={`transition-all duration-300 flex items-center justify-center ${
              showingInfo ? "w-12 h-12 rounded-full bg-black" : "px-6 py-2 rounded-full bg-black"
            }`}
          >
            {showingInfo ? <Check className="text-yellow-400 w-6 h-6" /> : <span className="text-yellow-400 font-semibold">Check</span>}
          </button>
        </div>

        {/* Add to Watchlist */}
        <div className="bg-yellow-400 text-black px-10 py-20 rounded-2xl shadow-lg text-center min-h-[400px] flex flex-col items-center transform transition-transform duration-300 hover:scale-105">
          <h3 className="text-3xl font-bold mb-6">Add to Watchlist</h3>
          <p className="text-lg leading-relaxed max-w-xs mb-6">Save this film to revisit later.</p>
          <button
            onClick={toggleWatchlist}
            className={`transition-all duration-300 flex items-center justify-center ${
              watchlisted ? "w-12 h-12 rounded-full bg-black" : "px-6 py-2 rounded-full bg-black"
            }`}
          >
            {watchlisted ? <Check className="text-yellow-400 w-6 h-6" /> : <span className="text-yellow-400 font-semibold">Add</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MovieDetails;
