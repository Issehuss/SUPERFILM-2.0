import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

function Movies({ searchQuery }) {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_KEY = process.env.REACT_APP_TMDB_KEY;

  useEffect(() => {
    const fetchMovies = async () => {
      setLoading(true);
      try {
        let url = '';

        if (searchQuery.trim() === '') {
          // No search → Show "Now Playing" movies
          url = `https://api.themoviedb.org/3/movie/now_playing?api_key=${API_KEY}&language=en-US&page=1`;
        } else {
          // Search entered → Use global movie search
          const encoded = encodeURIComponent(searchQuery);
          url = `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&language=en-US&query=${encoded}&page=1&include_adult=false`;
        }

        const res = await fetch(url);
        const data = await res.json();
        const sortedMovies = (data.results || []).sort((a, b) => b.popularity - a.popularity);
        setMovies(sortedMovies);
      } catch (error) {
        console.error("Error fetching movies from TMDB:", error);
        setMovies([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, [searchQuery, API_KEY]);

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold text-yellow-400">
          {searchQuery ? `Search Results for "${searchQuery}"` : "🎬 Now Playing in Cinemas"}
        </h2>
      </div>

      {loading ? (
        <p className="text-center text-zinc-400">Loading movies...</p>
      ) : movies.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
          {movies.map((movie) => (
            <Link
              to={`/movie/${movie.id}`}
              key={movie.id}
              className="overflow-hidden rounded-lg transform hover:scale-105 transition-transform duration-300 hover:ring-2 hover:ring-yellow-400"
            >
              {movie.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                  alt={movie.title}
                  className="w-full h-72 object-cover"
                />
              ) : (
                <div className="w-full h-72 flex items-center justify-center bg-zinc-800 text-zinc-400">
                  No Image
                </div>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-center text-zinc-400">No movies found.</p>
      )}
    </div>
  );
}

export default Movies;

