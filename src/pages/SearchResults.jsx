import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

function SearchResults() {
  const [searchParams] = useSearchParams();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const query = searchParams.get('q');
  const API_KEY = process.env.REACT_APP_TMDB_KEY;
  const navigate = useNavigate();

  useEffect(() => {
    if (!query) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        setResults(data.results || []);
      } catch (err) {
        console.error('Error fetching search results:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [query, API_KEY]);

  return (
    <div className="p-6 max-w-6xl mx-auto text-white">
      <h1 className="text-2xl font-bold mb-4">Search Results for “{query}”</h1>
      {loading ? (
        <p className="text-zinc-400">Searching TMDB...</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {results.map((movie) => (
            <div
              key={movie.id}
              className="cursor-pointer hover:scale-105 transition-transform"
              onClick={() => navigate(`/movie/${movie.id}`)}
            >
              <img
                src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                alt={movie.title}
                className="rounded-lg w-full"
              />
              <p className="mt-2 text-sm">{movie.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SearchResults;
