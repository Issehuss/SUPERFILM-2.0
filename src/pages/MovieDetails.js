import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check } from 'lucide-react';

function MovieDetails() {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [cast, setCast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [watchlisted, setWatchlisted] = useState(false);
  const [showingInfo, setShowingInfo] = useState(false);
  const [watchProviders, setWatchProviders] = useState([]);

  const API_KEY = process.env.REACT_APP_TMDB_KEY;

  const providerLinks = {
    "Netflix": "https://www.netflix.com",
    "Amazon Prime Video": "https://www.primevideo.com",
    "Disney Plus": "https://www.disneyplus.com",
    "Hulu": "https://www.hulu.com",
    "Apple TV": "https://tv.apple.com",
    "Paramount Plus": "https://www.paramountplus.com",
    "Peacock": "https://www.peacocktv.com"
  };

  useEffect(() => {
    const fetchMovieDetails = async () => {
      setLoading(true);
      try {
        const [movieRes, creditsRes, providerRes] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${API_KEY}&language=en-US`),
          fetch(`https://api.themoviedb.org/3/movie/${id}/credits?api_key=${API_KEY}&language=en-US`),
          fetch(`https://api.themoviedb.org/3/movie/${id}/watch/providers?api_key=${API_KEY}`)
        ]);

        const movieData = await movieRes.json();
        const creditsData = await creditsRes.json();
        const providerData = await providerRes.json();

        setMovie(movieData);
        setCast(creditsData.cast.slice(0, 5));
        const regionData = providerData.results?.GB || providerData.results?.US || {};
        setWatchProviders(regionData.flatrate || []);
      } catch (error) {
        console.error('Error fetching movie details:', error);
        setMovie(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMovieDetails();
  }, [id, API_KEY]);

  // Check if this movie is in the user's watchlist
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('watchlist')) || [];
    const isInWatchlist = saved.some(item => item.id === parseInt(id));
    setWatchlisted(isInWatchlist);
  }, [id]);

  const toggleWatchlist = () => {
    const saved = JSON.parse(localStorage.getItem('watchlist')) || [];
    const isInWatchlist = saved.some(item => item.id === movie.id);
    let updated;

    if (isInWatchlist) {
      updated = saved.filter(item => item.id !== movie.id);
      setWatchlisted(false);
    } else {
      updated = [{ id: movie.id, title: movie.title, posterPath: movie.poster_path }, ...saved];
      setWatchlisted(true);
    }

    localStorage.setItem('watchlist', JSON.stringify(updated));
  };

  if (loading) return <p className="text-center text-zinc-400">Loading movie details...</p>;
  if (!movie) return <p className="text-center text-zinc-400">Movie not found.</p>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row gap-8">
        <img
          src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
          alt={movie.title}
          className="w-full md:w-64 rounded-lg shadow-lg"
        />

        <div>
          <h2 className="text-3xl font-bold mb-2">{movie.title}</h2>
          <p className="text-sm text-zinc-400 mb-4">Release Date: {movie.release_date}</p>
          <p className="text-zinc-200 mb-6">{movie.overview}</p>
          <p className="text-sm text-zinc-400">Runtime: {movie.runtime} minutes</p>
          <p className="text-sm text-zinc-400 mt-2">Rating: {movie.vote_average}/10</p>
          <div className="mt-6">
            <h3 className="text-xl font-semibold text-yellow-400 mb-2">Cast</h3>
            <ul className="list-disc list-inside text-zinc-300">
              {cast.map((actor) => (
                <li key={actor.cast_id}>{actor.name} as {actor.character}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Yellow Action Cards */}
      <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 w-full">
        {/* Next Screening */}
        <div className="bg-yellow-400 text-black px-10 py-20 rounded-2xl shadow-lg text-center min-h-[400px] flex flex-col items-center transform transition-transform duration-300 hover:scale-105">
          <h3 className="text-3xl font-bold mb-6">Next Screening?</h3>
          <p className="text-lg leading-relaxed max-w-xs mb-6">Would you like to make this your film club's next event?</p>
          <button
            onClick={() => setConfirmed(!confirmed)}
            className={`transition-all duration-300 flex items-center justify-center ${
              confirmed ? 'w-12 h-12 rounded-full bg-black' : 'px-6 py-2 rounded-full bg-black'
            }`}
          >
            {confirmed ? (
              <Check className="text-yellow-400 w-6 h-6" />
            ) : (
              <span className="text-yellow-400 font-semibold">Yes</span>
            )}
          </button>
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
            onClick={() => window.open(`https://www.google.com/search?q=${movie.title} showtimes near me`, '_blank')}
            className={`transition-all duration-300 flex items-center justify-center ${
              showingInfo ? 'w-12 h-12 rounded-full bg-black' : 'px-6 py-2 rounded-full bg-black'
            }`}
          >
            {showingInfo ? (
              <Check className="text-yellow-400 w-6 h-6" />
            ) : (
              <span className="text-yellow-400 font-semibold">Check</span>
            )}
          </button>
        </div>

        {/* Add to Watchlist */}
        <div className="bg-yellow-400 text-black px-10 py-20 rounded-2xl shadow-lg text-center min-h-[400px] flex flex-col items-center transform transition-transform duration-300 hover:scale-105">
          <h3 className="text-3xl font-bold mb-6">Add to Watchlist</h3>
          <p className="text-lg leading-relaxed max-w-xs mb-6">Save this film to revisit later.</p>
          <button
            onClick={toggleWatchlist}
            className={`transition-all duration-300 flex items-center justify-center ${
              watchlisted ? 'w-12 h-12 rounded-full bg-black' : 'px-6 py-2 rounded-full bg-black'
            }`}
          >
            {watchlisted ? (
              <Check className="text-yellow-400 w-6 h-6" />
            ) : (
              <span className="text-yellow-400 font-semibold">Add</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MovieDetails;


