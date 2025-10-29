// src/pages/SearchResults.jsx
import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { searchMovies } from "../lib/tmdbClient";

function SearchResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const query = searchParams.get("q")?.trim() || "";
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!query) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const hits = await searchMovies(query); // [{ id, title, year, posterUrl, backdropUrl }]
        if (!cancelled) setResults((hits || []).slice(0, 40));
      } catch (err) {
        console.error("Error fetching search results:", err);
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="p-6 max-w-6xl mx-auto text-white">
      <h1 className="text-2xl font-bold mb-4">
        {query ? <>Search Results for “{query}”</> : "Search"}
      </h1>

      {!query && (
        <p className="text-zinc-400">Type something in the search bar to get started.</p>
      )}

      {query && loading && <p className="text-zinc-400">Searching…</p>}

      {query && !loading && results.length === 0 && (
        <p className="text-zinc-400">No results found.</p>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
          {results.map((movie) => {
            const poster =
              movie.posterUrl ||
              (movie.poster_path
                ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                : movie.backdropUrl || "");

            return (
              <button
                key={movie.id}
                type="button"
                className="cursor-pointer hover:scale-[1.02] transition-transform text-left"
                onClick={() => navigate(`/movie/${movie.id}`)}
                title={movie.title}
              >
                <div className="aspect-[2/3] w-full overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
                  {poster ? (
                    <img
                      src={poster}
                      alt={movie.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-xs text-zinc-400">
                      No image
                    </div>
                  )}
                </div>
                <p className="mt-2 text-sm line-clamp-2">{movie.title}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SearchResults;
