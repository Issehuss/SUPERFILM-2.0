import React, { useState } from 'react';

const TMDB_API_KEY = 'cfa8fb0dd27080b54073069a5c29a185';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w185';

const FilmSearch = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const searchFilms = async () => {
    if (!query) return;
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`
      );
      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error('Error fetching TMDB data:', error);
    }
  };

  const handleFilmSelect = (film) => {
    onSelect(film);
    setQuery('');
    setResults([]); // ✅ Clear search results on select
  };

  return (
    <div className="bg-gray-900 p-4 rounded-md text-white">
      <div className="relative flex items-center focus-within:outline-none focus-within:ring-0">
        <input
          type="text"
          placeholder="Search for a film..."
          className="appearance-none will-change-auto w-10 focus:w-full sm:focus:w-96 pl-10 pr-4 py-2 bg-gray-800 text-white rounded-full transition-all duration-300 outline-none focus:outline-none focus-visible:outline-none focus:ring-1 focus:ring-gray-600"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => e.key === 'Enter' && searchFilms()}
        />
        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white pointer-events-none">
          🔍
        </span>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
          {results.map((film) => (
            <div
              key={film.id}
              className="cursor-pointer hover:bg-gray-800 p-2 rounded"
              onClick={() => handleFilmSelect(film)}
            >
              <img
                src={
                  film.poster_path
                    ? `${TMDB_IMAGE_BASE}${film.poster_path}`
                    : 'https://via.placeholder.com/185x278?text=No+Image'
                }
                alt={film.title}
                className="w-full h-[278px] object-cover rounded"
              />
              <p className="mt-2 text-sm text-center truncate">{film.title}</p>
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`
        input {
          -webkit-appearance: none;
          appearance: none;
        }

        input:focus,
        input:focus-visible,
        input:focus-within {
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>
    </div>
  );
};

export default FilmSearch;
