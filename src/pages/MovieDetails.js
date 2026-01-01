// src/pages/MovieDetails.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check } from "lucide-react";
import { toast } from "react-hot-toast";
import { useUser } from "../context/UserContext";
import useWatchlist from "../hooks/useWatchlist";
import supabase from "../supabaseClient";
import { env } from "../lib/env";
import TmdbImage from "../components/TmdbImage";

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INT_RX = /^\d+$/;
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

const cacheKey = (tmdbId) => `sf.movie.${tmdbId}`;

const readCache = (tmdbId) => {
  if (!tmdbId) return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(tmdbId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || !parsed?.data) return null;
    if (Date.now() - parsed.at > CACHE_TTL) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeCache = (tmdbId, data) => {
  if (!tmdbId || !data) return;
  try {
    sessionStorage.setItem(cacheKey(tmdbId), JSON.stringify({ at: Date.now(), data }));
  } catch {
    // ignore storage errors
  }
};

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
  const [nominating, setNominating] = useState(false);
  const [nominated, setNominated] = useState(false);
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
      // 2) Fallback to direct TMDB (browser) — prefer v4 bearer token
      const base = env.TMDB_API_BASE || "https://api.themoviedb.org/3";
      const url = new URL(base + (path.startsWith("/") ? path : `/${path}`));
      for (const [k, v] of Object.entries(query || {})) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }

      const headers = {};
      if (env.TMDB_READ_TOKEN) {
        headers.Authorization = `Bearer ${env.TMDB_READ_TOKEN}`;
      } else if (env.TMDB_API_KEY) {
        url.searchParams.set("api_key", env.TMDB_API_KEY);
      } else {
        throw new Error("TMDB token missing. Add TMDB_READ_TOKEN or TMDB_API_KEY to env.");
      }

      const res = await fetch(url.toString(), { headers });
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
    let tmdbIdResolved = null;

    (async () => {
      setLoading(true);
      setMovie(null);
      setCast([]);
      setWatchProviders([]);

      try {
        const tmdbId = await resolveTmdbId(rawParam);
        tmdbIdResolved = tmdbId;
      if (!tmdbId) {
        if (!cancelled) setMovie(null);
        return;
      }

        // 1) Hydrate from cache instantly
        const cached = readCache(tmdbId);
        if (cached && !cancelled) {
          setMovie(cached.movie);
          setCast(cached.cast || []);
          setWatchProviders(cached.watchProviders || []);
          setLoading(false);
        }

        // 2) Revalidate fresh data
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
        writeCache(tmdbId, {
          movie: movieData,
          cast: (creditsData?.cast || []).slice(0, 5),
          watchProviders: region?.flatrate || [],
        });
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

  // Check if already nominated by this user for active club (same behavior as Movies page)
  useEffect(() => {
    let cancelled = false;
    const activeClubId = localStorage.getItem("activeClubId");
    if (!activeClubId || !user?.id || !movie?.id) {
      setNominated(false);
      return;
    }
    (async () => {
      try {
        const { count, error } = await supabase
          .from("nominations")
          .select("*", { count: "exact", head: true })
          .eq("club_id", activeClubId)
          .eq("movie_id", movie.id)
          .eq("created_by", user.id);
        if (error) throw error;
        if (!cancelled) setNominated((count || 0) > 0);
      } catch {
        if (!cancelled) setNominated(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [movie?.id, user?.id, clubId]);

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
    const activeClubId = clubId || localStorage.getItem("activeClubId");
    if (!activeClubId) {
      alert("Open your club page first so I know which club to nominate for.");
      return;
    }
    if (!user?.id) {
      alert("Please sign in to nominate.");
      return;
    }

    setNominating(true);
    try {
      const { error } = await supabase
        .from("nominations")
        .upsert(
          {
            club_id: activeClubId,
            movie_id: movie.id,
            movie_title: movie.title || "Untitled",
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
      setConfirmed(true);
      setNominated(true);
    } catch (e) {
      alert(e.message || "Could not add nomination.");
    } finally {
      setNominating(false);
    }
  }

  async function handleUnnominate() {
    if (!movie) return;
    const activeClubId = clubId || localStorage.getItem("activeClubId");
    if (!activeClubId) {
      alert("Open your club page first so I know which club to un-nominate from.");
      return;
    }
    if (!user?.id) {
      alert("Please sign in to manage nominations.");
      return;
    }
    setNominating(true);
    try {
      const { error } = await supabase
        .from("nominations")
        .delete()
        .eq("club_id", activeClubId)
        .eq("movie_id", movie.id)
        .eq("created_by", user.id);
      if (error) throw error;
      toast.success("Nomination removed");
      setConfirmed(false);
      setNominated(false);
    } catch (e) {
      alert(e.message || "Could not remove nomination.");
    } finally {
      setNominating(false);
    }
  }

  // ---- UI ----
  if (loading) return <p className="text-center text-zinc-400">Loading movie details...</p>;
  if (!movie) return <p className="text-center text-zinc-400">Movie not found.</p>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-72 lg:w-80 max-w-md">
          <div className="aspect-[2/3] overflow-hidden rounded-2xl shadow-lg border border-zinc-800 bg-zinc-900">
            <TmdbImage
              src={
                movie.poster_path
                  ? `https://image.tmdb.org/t/p/w780${movie.poster_path}`
                  : movie.backdrop_path
                  ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}`
                  : ""
              }
              alt={movie.title}
              className="w-full h-full"
              imgClassName="w-full h-full object-cover"
              imgProps={{ loading: "eager" }}
            />
          </div>
        </div>

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
            onClick={nominated ? handleUnnominate : handleNominate}
            disabled={nominating}
            className={`transition-all duration-300 flex items-center justify-center ${
              confirmed || nominated
                ? "w-12 h-12 rounded-full bg-black"
                : "px-6 py-2 rounded-full bg-black"
            } disabled:opacity-60`}
          >
            {confirmed || nominated ? (
              <Check className="text-yellow-400 w-6 h-6" />
            ) : (
              <span className="text-yellow-400 font-semibold">
                Add to nominations
              </span>
            )}
          </button>
          {confirmed || nominated ? (
            <p className="mt-3 text-xs text-black/80 text-center max-w-xs">
              Added to your club&apos;s nominations. You can remove it from here.
            </p>
          ) : (
            <p className="mt-3 text-xs text-black/80 text-center max-w-xs">
              Adds this title to the current nominations carousel for your club.
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
                  <TmdbImage
                    src={`https://image.tmdb.org/t/p/original${provider.logo_path}`}
                    alt={provider.provider_name}
                    className="w-8 h-8"
                    imgClassName="object-contain"
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
