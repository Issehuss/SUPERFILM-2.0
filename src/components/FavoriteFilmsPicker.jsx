// src/components/FavoriteFilmsPicker.jsx
import { useMemo, useState } from "react";
import { getEnv } from "../utils/env"; // make sure this file exists as we added earlier

/**
 * Props:
 * - value: array of current favourites, e.g. [{ id, title, poster_path, title, release_date }]
 * - max: number (optional) limit of favourites (default 20)
 * - onChange: (newArray) => void
 * - onAdd?: (movie) => void
 * - onRemove?: (movie) => void
 */
export default function FavoriteFilmsPicker({
  value = [],
  max = 20,
  onChange,
  onAdd,
  onRemove,
}) {
  const TMDB_KEY = getEnv("TMDB_KEY") || getEnv("TMDB_API_KEY");

  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const canAddMore = value.length < max;

  async function tmdbSearchMovies(query, page = 1) {
    if (!TMDB_KEY || !query?.trim()) return { results: [] };
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&language=en-US&query=${encodeURIComponent(
      query
    )}&include_adult=false&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`);
    return res.json(); // { results: [...] }
  }

  const handleSearch = async () => {
    if (!TMDB_KEY || !q.trim()) return;
    setLoading(true);
    try {
      const data = await tmdbSearchMovies(q);
      const items = (data?.results || []).slice(0, 20);
      setResults(items);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const alreadyPicked = useMemo(() => {
    const set = new Set(value.map((m) => m.id));
    return set;
  }, [value]);

  const addFav = (m) => {
    if (!canAddMore) return;
    const movie = {
      id: m.id,
      title: m.title,
      poster_path: m.poster_path,
      release_date: m.release_date,
    };
    const next = [...value, movie];
    onChange?.(next);
    onAdd?.(movie);
  };

  const removeFav = (id) => {
    const movie = value.find((x) => x.id === id);
    const next = value.filter((x) => x.id !== id);
    onChange?.(next);
    onRemove?.(movie);
  };

  return (
    <div className="mt-6 bg-zinc-900 p-4 rounded-md shadow">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-lg font-semibold">Favourite Films</h3>
        <span className="text-xs text-zinc-400">
          {value.length}/{max}
        </span>
      </div>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search films…"
          className="flex-1 px-3 py-2 rounded bg-zinc-800 text-white border border-zinc-700 focus:outline-none"
          disabled={!TMDB_KEY}
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-yellow-500 text-black font-semibold rounded hover:bg-yellow-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!TMDB_KEY || loading}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {!TMDB_KEY && (
        <p className="mt-3 text-xs text-red-400">
          Set <code>REACT_APP_TMDB_KEY</code> (CRA) or <code>VITE_TMDB_KEY</code> (Vite) in{" "}
          <code>.env.local</code> to enable search. (Also supported:{" "}
          <code>REACT_APP_TMDB_API_KEY</code>/<code>VITE_TMDB_API_KEY</code>.)
        </p>
      )}

      {/* Current favourites */}
      {value.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm text-zinc-300 mb-2">Your favourites</h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {value.map((m) => (
              <div key={m.id} className="relative group">
                <img
                  src={
                    m.poster_path
                      ? `https://image.tmdb.org/t/p/w342${m.poster_path}`
                      : "https://via.placeholder.com/342x513?text=No+Poster"
                  }
                  alt={m.title}
                  className="rounded-lg shadow w-full h-auto"
                  loading="lazy"
                />
                <button
                  onClick={() => removeFav(m.id)}
                  className="absolute top-1 right-1 px-2 py-1 text-xs rounded bg-black/70 hover:bg-black/90 text-white opacity-0 group-hover:opacity-100 transition"
                  aria-label={`Remove ${m.title}`}
                >
                  Remove
                </button>
                <div className="mt-1 text-xs text-zinc-300 line-clamp-2">
                  {m.title}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search results */}
      {!!results.length && (
        <div className="mt-6">
          <h4 className="text-sm text-zinc-300 mb-2">Results</h4>
          {!canAddMore && (
            <p className="text-xs text-yellow-400 mb-2">
              You reached the limit of {max} favourites. Remove one to add more.
            </p>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {results.map((m) => {
              const picked = alreadyPicked.has(m.id);
              return (
                <div key={m.id} className="relative">
                  <img
                    src={
                      m.poster_path
                        ? `https://image.tmdb.org/t/p/w342${m.poster_path}`
                        : "https://via.placeholder.com/342x513?text=No+Poster"
                    }
                    alt={m.title}
                    className={`rounded-lg shadow w-full h-auto ${
                      picked ? "opacity-60" : "cursor-pointer hover:opacity-90"
                    }`}
                    loading="lazy"
                    onClick={() => (!picked && canAddMore ? addFav(m) : null)}
                  />
                  <div className="mt-1 text-xs text-zinc-300 line-clamp-2">
                    {m.title}
                  </div>
                  {picked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="px-2 py-1 text-[10px] rounded bg-black/70 text-white">
                        Added
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
