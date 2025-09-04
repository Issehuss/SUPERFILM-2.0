import { useState } from 'react';
import BannerCropper from './BannerCropper';
import { FastAverageColor } from 'fast-average-color';

const BannerPicker = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [backdrops, setBackdrops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bannerToCrop, setBannerToCrop] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  const API_KEY = process.env.REACT_APP_TMDB_KEY;

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);

    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(query)}&include_adult=false`
      );
      const data = await res.json();
      const results = data.results || [];
      const images = results
        .map((movie) => movie.backdrop_path)
        .filter((path) => path !== null)
        .slice(0, 10);

      setBackdrops(images);
    } catch (err) {
      console.error("Failed to fetch backdrops:", err);
      setBackdrops([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = async (path) => {
    const originalUrl = `https://image.tmdb.org/t/p/original${path}`;
    try {
      const res = await fetch(originalUrl);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerToCrop(reader.result);
        setShowCropper(true);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('Failed to load image securely:', err);
    }
  };

  const getGradientFromImage = async (imageSrc) => {
    const fac = new FastAverageColor();
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = imageSrc;
      img.onload = () => {
        const color = fac.getColor(img).hex;
        resolve(`linear-gradient(to bottom, ${color}, #000000)`);
      };
      img.onerror = () => resolve(null);
    });
  };

  const handleCropComplete = async (croppedImage) => {
    const gradient = await getGradientFromImage(croppedImage);
    localStorage.setItem('userBanner', croppedImage);
    localStorage.setItem('userGradient', gradient);
    onSelect({ image: croppedImage, gradient });
    setShowCropper(false);
    setBannerToCrop(null);
  };

  const handleCancelCrop = () => {
    setShowCropper(false);
    setBannerToCrop(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="mt-6 bg-zinc-900 p-4 rounded-md shadow">
      <h3 className="text-lg font-semibold mb-2">Search for a Banner Image</h3>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-2 rounded bg-zinc-800 text-white border border-zinc-700 focus:outline-none"
          placeholder="Enter film name..."
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-yellow-500 text-black font-semibold rounded hover:bg-yellow-400 transition"
        >
          Search
        </button>
      </div>

      {loading && <p className="mt-3 text-zinc-400">Searching backdrops...</p>}

      {backdrops.length > 0 && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {backdrops.map((path, index) => (
            <img
              key={index}
              src={`https://image.tmdb.org/t/p/w500${path}`}
              alt="Backdrop"
              className="rounded-lg cursor-pointer hover:opacity-80 transition"
              onClick={() => handleImageClick(path)}
            />
          ))}
        </div>
      )}

      {showCropper && bannerToCrop && (
        <BannerCropper
          imageSrc={bannerToCrop}
          onCancel={handleCancelCrop}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
};

export default BannerPicker;






