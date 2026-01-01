// src/components/FavoriteFilmsPicker.jsx
import { useMemo, useState } from "react";
import { searchMovies } from "../lib/tmdbClient";
import TmdbImage from "./TmdbImage";

/**
 * Props:
 * - value: array of current favourites, e.g. [{ id, title, poster_path, release_date }]
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
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const canAddMore = value.length < max;

  // Helper: convert normalized searchMovies result -> shape your app stores
  function normalizeToFavShape(hit) {
    // hit: { id, title, year, posterUrl, backdropUrl }
    // We want poster_path only (relative), if possible.
    let poster_path = null;
    if (hit?.posterUrl) {
      // try to extract the TMDB relative path from a full CDN URL
      // e.g. https://image.tmdb.org/t/p/w500/abc.jpg -> /abc.jpg
      const m = hit.posterUrl.match(/\/t\/p\/w\d+(.+)$/);
      poster_path = m ? m[1] : null; // will be like "/abc.jpg"
    }
    return {
      id: hit.id,
      title: hit.title,
      poster_path, // acceptable to be null; UI has a placeholder
      release_date: hit.year ? String(hit.year) + "-01-01" : null, // best-effort; original API had full date
    };
  }

  async function handleSearch() {
    const query = q.trim();
    if (!query) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const hits = await searchMovies(query); // normalized array
      // Keep up to 20 (like your old behavior)
      setResults((hits || []).slice(0, 20));
    } catch (e) {
      console.error("FavoriteFilmsPicker search error:", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  const alreadyPicked = useMemo(() => {
    return new Set(value.map((m) => m.id));
  }, [value]);

  const addFav = (hit) => {
    if (!canAddMore) return;
    const movie = normalizeToFavShape(hit);
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
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-yellow-500 text-black font-semibold rounded hover:bg-yellow-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {/* Current favourites */}
      {value.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm text-zinc-300 mb-2">Your favourites</h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {value.map((m) => (
              <div key={m.id} className="relative group">
                <TmdbImage
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

      {/* Search results (from secure proxy) */}
      {!!results.length && (
        <div className="mt-6">
          <h4 className="text-sm text-zinc-300 mb-2">Results</h4>
          {!canAddMore && (
            <p className="text-xs text-yellow-400 mb-2">
              You reached the limit of {max} favourites. Remove one to add more.
            </p>
          )}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {results.map((hit) => {
              const picked = alreadyPicked.has(hit.id);
              const posterUrl =
                hit.posterUrl ||
                (hit.poster_path
                  ? `https://image.tmdb.org/t/p/w342${hit.poster_path}`
                  : "");
              return (
                <div key={hit.id} className="relative">
                  <TmdbImage
                    src={posterUrl || "https://via.placeholder.com/342x513?text=No+Poster"}
                    alt={hit.title}
                    className={`rounded-lg shadow w-full h-auto ${
                      picked ? "opacity-60" : "cursor-pointer hover:opacity-90"
                    }`}
                    loading="lazy"
                    onClick={() => (!picked && canAddMore ? addFav(hit) : null)}
                  />
                  <div className="mt-1 text-xs text-zinc-300 line-clamp-2">
                    {hit.title}
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
