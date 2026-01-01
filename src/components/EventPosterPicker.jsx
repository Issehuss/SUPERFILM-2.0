import React, { useState } from "react";
import TmdbImage from "./TmdbImage";

export default function EventPosterPicker({ onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  async function searchTMDB() {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    const key = process.env.REACT_APP_TMDB_API_KEY;
    if (!key) {
      console.error("[TMDB] Missing REACT_APP_TMDB_API_KEY");
      setResults([]);
      setLoading(false);
      return;
    }

    try {
      const url = `https://api.themoviedb.org/3/search/movie?api_key=${key}&query=${encodeURIComponent(
        query
      )}`;
      const res = await fetch(url);
      const data = await res.json();
      setResults(data.results || []);
    } catch (e) {
      console.error("[TMDB Search] Error:", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter") searchTMDB();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          className="input flex-1 rounded-lg bg-zinc-900 border border-zinc-700 p-2 text-white placeholder-zinc-500"
          placeholder="Search for a film…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
        />

        <button
          onClick={searchTMDB}
          className="px-4 py-2 rounded-lg bg-yellow-400 text-black font-semibold hover:bg-yellow-300 transition-colors"
        >
          Search
        </button>
      </div>

      {/* Results */}
      {loading && (
        <div className="text-zinc-400 text-sm">Searching for films…</div>
      )}

      {!loading && hasSearched && results.length === 0 && (
        <div className="text-zinc-500 text-sm">No films found.</div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {results.map((movie) => {
            const poster = movie.poster_path
              ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
              : null;

            if (!poster) return null;

            return (
              <div
                key={movie.id}
                onClick={() =>
                  onSelect({
                    title: movie.title,
                    posterUrl: `https://image.tmdb.org/t/p/original${movie.poster_path}`,
                  })
                }
                className="cursor-pointer group"
              >
                <TmdbImage
                  src={poster}
                  alt={movie.title}
                  className="w-full h-full rounded-lg border border-zinc-700"
                  imgClassName="transition-all group-hover:border-yellow-400 rounded-lg"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
