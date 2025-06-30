import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { MapPin, Film, Search, Star, Upload, X, ImagePlus } from 'lucide-react';
import { useUser } from '../context/UserContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const fallbackNext = "/fallback-next.jpg";
const fallbackLocation = "/fallback-location.jpg";
const fallbackBanner = "/fallback-banner.jpg";

const cleanTitleForSearch = (title) => {
  return title
    .replace(/screening of/gi, '')
    .replace(/discussion night/gi, '')
    .replace(/['"]/g, '')
    .trim();
};

const fetchPosterFromTMDB = async (title) => {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&api_key=cfa8fb0dd27080b54073069a5c29a185`
    );
    const data = await response.json();
    const firstResult = data.results?.[0];
    return firstResult?.poster_path
      ? `https://image.tmdb.org/t/p/w500${firstResult.poster_path}`
      : null;
  } catch (error) {
    console.error(`Error fetching poster for ${title}:`, error);
    return null;
  }
};

function getCountdown(eventDateStr) {
  const eventDate = new Date(eventDateStr);
  const now = new Date();
  const diff = eventDate - now;
  if (isNaN(diff) || diff <= 0) return null;
  const minutes = Math.floor(diff / 60000) % 60;
  const hours = Math.floor(diff / 3600000) % 24;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return { days, hours, minutes, isUrgent: diff < 3600000 };
}

function ClubProfile() {
  const { id } = useParams();
  const [club, setClub] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useUser();
  const [isEditing, setIsEditing] = useState(false);
  const [featuredSearch, setFeaturedSearch] = useState('');
  const [featuredResults, setFeaturedResults] = useState([]);
  const [nextSearch, setNextSearch] = useState('');
  const [nextSearchResults, setNextSearchResults] = useState([]);

  useEffect(() => {
    const mockClubs = [
      {
        id: 1,
        name: "Indie Reels",
        tagline: "Exploring bold and beautiful cinema.",
        about: "We’re a group of passionate film lovers...",
        location: "London",
        members: 24,
        banner: fallbackBanner,
        nextEvent: {
          title: "Screening of 'Past Lives'",
          date: "2025-06-30T20:00:00",
          location: "Electric Cinema, Notting Hill",
          poster: fallbackNext,
          caption: "An upcoming screening we're excited for."
        },
        locationImage: fallbackLocation,
        locationCaption: "Where we're meeting this Saturday.",
        featuredFilms: []
      }
    ];

    const loadClub = async () => {
      const found = mockClubs.find(c => String(c.id) === id);
      if (!found) return;
      found.nextEvent.poster = await fetchPosterFromTMDB(cleanTitleForSearch(found.nextEvent.title)) || fallbackNext;
      setClub(found);
      if (user) setIsAdmin(user.roles?.includes('president') || user.roles?.includes('vice_president'));
    };

    loadClub();
  }, [id, user]);

  const handleImageUpload = (e, section) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setClub(prev => {
        const updated = { ...prev };
        if (section === 'location') updated.locationImage = reader.result;
        if (section === 'nextEvent') updated.nextEvent.poster = reader.result;
        if (section === 'banner') updated.banner = reader.result;
        return updated;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFeaturedSearch = async () => {
    if (!featuredSearch.trim()) return;
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(featuredSearch)}&api_key=cfa8fb0dd27080b54073069a5c29a185`);
    const data = await res.json();
    setFeaturedResults(data.results || []);
  };

  const handleNextEventSearch = async () => {
    if (!nextSearch.trim()) return;
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(nextSearch)}&api_key=cfa8fb0dd27080b54073069a5c29a185`);
    const data = await res.json();
    setNextSearchResults(data.results || []);
  };

  const addFeaturedFilm = (url) => {
    setClub(prev => ({ ...prev, featuredFilms: [...prev.featuredFilms, url] }));
  };

  const countdown = club?.nextEvent?.date ? getCountdown(club.nextEvent.date) : null;

  const updateField = (section, field, value) => {
    setClub(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  return club ? (
    <div className="min-h-screen bg-black text-white">
      <div className="h-60 bg-cover bg-center flex items-end px-6 py-4 relative" style={{ backgroundImage: `url(${club.banner})` }}>
        <div>
          <h1 className="text-3xl font-bold">{club.name}</h1>
          <p className="italic text-yellow-300 text-sm">{club.tagline}</p>
        </div>
        {isAdmin && isEditing && (
          <label className="absolute top-3 right-12 bg-black bg-opacity-60 rounded-full p-2 cursor-pointer">
            <ImagePlus size={18} />
            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'banner')} className="hidden" />
          </label>
        )}
        {isAdmin && (
          <button onClick={() => setIsEditing(!isEditing)} className="ml-auto bg-zinc-800 px-3 py-1 rounded text-sm hover:bg-zinc-700">
            {isEditing ? 'Finish Editing' : 'Edit'}
          </button>
        )}
      </div>

      {countdown && (
        <div className={`mt-4 mx-6 px-4 py-2 rounded-lg w-fit font-mono text-sm ${countdown.isUrgent ? 'bg-red-600' : 'bg-yellow-500'} text-black`}>
          {countdown.days}d {countdown.hours}h {countdown.minutes}m until screening
        </div>
      )}

      <div className="p-6 grid md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-bold text-yellow-400 flex items-center mb-2"><Film className="w-5 h-5 mr-2" /> Next Screening</h2>
          <img src={club.nextEvent.poster} alt="Next Screening Poster" className="rounded-lg w-full max-w-sm" />
          {isAdmin && isEditing && (
            <div className="mt-2">
              <input value={nextSearch} onChange={(e) => setNextSearch(e.target.value)} className="bg-zinc-800 p-1 rounded w-full" placeholder="Search film title..." />
              <button onClick={handleNextEventSearch} className="bg-yellow-500 text-black px-2 py-1 mt-1 rounded">Search</button>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {nextSearchResults.map(movie => (
                  <img
                    key={movie.id}
                    src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                    alt=""
                    className="cursor-pointer hover:opacity-80"
                    onClick={() => updateField('nextEvent', 'poster', `https://image.tmdb.org/t/p/w500${movie.poster_path}`)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          {isEditing ? (
            <div className="space-y-2">
              <input value={club.nextEvent.title} onChange={(e) => updateField('nextEvent', 'title', e.target.value)} className="w-full bg-zinc-800 p-2 rounded" />
              <input value={club.nextEvent.location} onChange={(e) => updateField('nextEvent', 'location', e.target.value)} className="w-full bg-zinc-800 p-2 rounded" />
              <textarea value={club.nextEvent.caption} onChange={(e) => updateField('nextEvent', 'caption', e.target.value)} className="w-full bg-zinc-800 p-2 rounded" />
              <DatePicker
                selected={new Date(club.nextEvent.date)}
                onChange={(date) => updateField('nextEvent', 'date', date.toISOString())}
                showTimeSelect
                dateFormat="Pp"
                className="bg-zinc-800 text-white p-2 rounded w-full"
              />
            </div>
          ) : (
            <div>
              <h3 className="text-white font-semibold text-lg">{club.nextEvent.title}</h3>
              <p className="text-sm text-zinc-300">{club.nextEvent.caption}</p>
              <p className="text-sm text-red-300 mt-2"><MapPin className="inline w-4 h-4 mr-1" /> {club.nextEvent.location}</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 pt-8">
        <h2 className="text-lg font-bold text-yellow-400 flex items-center mb-2"><MapPin className="w-5 h-5 mr-2" /> Where We Gather</h2>
        <img src={club.locationImage} alt="Location" className="rounded-lg" />
        {isEditing ? (
          <>
            <input type="file" onChange={(e) => handleImageUpload(e, 'location')} className="mt-2" />
            <textarea value={club.locationCaption} onChange={(e) => setClub(prev => ({ ...prev, locationCaption: e.target.value }))} className="w-full bg-zinc-800 p-2 mt-2 rounded" />
          </>
        ) : (
          <p className="text-sm text-zinc-300 mt-2">{club.locationCaption}</p>
        )}
      </div>

      <div className="px-6 pt-8 pb-12">
        <h2 className="text-lg font-bold text-yellow-400 flex items-center mb-2"><Star className="w-5 h-5 mr-2" /> Featured Films</h2>
        {isEditing && (
          <div className="flex gap-2 items-center mb-4">
            <input value={featuredSearch} onChange={(e) => setFeaturedSearch(e.target.value)} className="bg-zinc-800 p-2 rounded w-full" placeholder="Search for films..." />
            <button onClick={handleFeaturedSearch} className="bg-yellow-500 text-black px-4 py-2 rounded">Search</button>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {club.featuredFilms.map((url, idx) => <img key={idx} src={url} className="rounded-lg" />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {isEditing && featuredResults.map(movie => (
            <img
              key={movie.id}
              src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
              className="cursor-pointer hover:opacity-80"
              onClick={() => addFeaturedFilm(`https://image.tmdb.org/t/p/w500${movie.poster_path}`)}
            />
          ))}
        </div>
      </div>
    </div>
  ) : null;
}

export default ClubProfile;


















