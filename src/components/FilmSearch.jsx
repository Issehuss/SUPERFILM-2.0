// src/components/FilmSearch.jsx
import React, { useState } from "react";
import { searchMovies } from "../lib/tmdbClient"; // <- uses Supabase Edge Function
import TmdbImage from "./TmdbImage";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w185";

const FilmSearch = ({ onSelect }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Convert normalized searchMovies hit -> your app's expected shape
  function toCompatFilm(hit) {
    // hit: { id, title, year, posterUrl, backdropUrl }
    // try to recover a relative poster_path if possible
    let poster_path = null;
    if (hit?.posterUrl) {
      const m = hit.posterUrl.match(/\/t\/p\/w\d+(.+)$/);
      poster_path = m ? m[1] : null; // e.g. "/abc.jpg"
    }
    return {
      id: hit.id,
      title: hit.title,
      poster_path,
      release_date: hit.year ? `${hit.year}-01-01` : null,
      // keep full URLs on the object too (handy for UIs that accept them)
      posterUrl: hit.posterUrl || null,
      backdropUrl: hit.backdropUrl || null,
    };
  }

  const searchFilms = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      const hits = await searchMovies(q); // secure proxy
      setResults((hits || []).slice(0, 24).map(toCompatFilm));
    } catch (error) {
      console.error("Error fetching TMDB data:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilmSelect = (film) => {
    onSelect?.(film);
    setQuery("");
    setResults([]); // ✅ Clear search results on select
  };

  return (
    <div className="bg-gray-900 p-4 rounded-md text-white">
      <div className="relative flex items-center">
        <input
          type="text"
          placeholder="Search for a film..."
          className="appearance-none w-10 focus:w-full sm:focus:w-96 pl-10 pr-4 py-2 bg-gray-800 text-white rounded-full transition-all duration-300 outline-none ring-0 focus:ring-1 focus:ring-gray-600"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => e.key === "Enter" && searchFilms()}
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white pointer-events-none">
          🔍
        </span>
      </div>

      {loading && (
        <div className="mt-4 text-sm text-gray-300">Searching…</div>
      )}

      {!loading && results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
          {results.map((film) => (
            <button
              key={film.id}
              type="button"
              className="cursor-pointer hover:bg-gray-800 p-2 rounded text-left"
              onClick={() => handleFilmSelect(film)}
            >
              <TmdbImage
                src={
                  film.posterUrl
                    ? film.posterUrl
                    : film.poster_path
                    ? `${TMDB_IMAGE_BASE}${film.poster_path}`
                    : "https://via.placeholder.com/185x278?text=No+Image"
                }
                alt={film.title}
                className="w-full h-[278px]"
                imgClassName="rounded"
                loading="lazy"
              />
              <p className="mt-2 text-sm text-center truncate">{film.title}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FilmSearch;
