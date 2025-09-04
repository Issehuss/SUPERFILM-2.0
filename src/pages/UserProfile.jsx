import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import StatsAndWatchlist from '../components/StatsAndWatchlist';
import FilmSearch from '../components/FilmSearch';
import FavoriteFilmsGrid from '../components/FavoriteFilmsGrid';
import TasteCard from '../components/TasteCard';
import TasteCardPicker from '../components/TasteCardPicker';
import FavoriteFilms from '../components/FavoriteFilms';
import ClubBadge from '../components/ClubBadge';
import BannerPicker from '../components/BannerPicker';
import AvatarCropper from '../components/AvatarCropper';
import { questionList } from '../constants/tasteQuestions';
import { glowOptions } from '../constants/glowOptions';
import { useUser } from '../context/UserContext';
import supabase from '../supabaseClient.js'; // ✅ Supabase client

const UserProfile = ({ user }) => {
  const fallbackUser = {
    name: "Ava Rahimi",
    username: "cinemaava",
    avatar: "/avatars/ava.jpg",
    bannerImage: "/banners/decision.jpeg",
    bio: "Llover of quiet films where nothing happens. Taste of Cherry made me cry in silence.",
    favoriteDirector: "Abbas Kiarostami",
    club: "Film Poets",
    isCurrentUser: true,
  };

  const profileUser = user || fallbackUser;
  const location = useLocation();
  const navigate = useNavigate();
  const { avatar, setAvatar } = useUser();

  const [editMode, setEditMode] = useState(false);
  const [editingTasteCards, setEditingTasteCards] = useState([]);
  const [showBannerPicker, setShowBannerPicker] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(() => profileUser.avatar);
  const [bannerImage, setBannerImage] = useState(() => profileUser.bannerImage);
  const [bio, setBio] = useState(() => profileUser.bio);
  const [clubName, setClubName] = useState(() => profileUser.club);
  const [name, setName] = useState(() => profileUser.name);
  const [username, setUsername] = useState(() => profileUser.username);
  const [rawAvatarImage, setRawAvatarImage] = useState(null);
  const [showCropper, setShowCropper] = useState(false);
  const [useGlowStyle, setUseGlowStyle] = useState(true);
  const [tasteAnswers, setTasteAnswers] = useState([]);
  const [favoriteFilms, setFavoriteFilms] = useState([]);
  const [useGradient, setUseGradient] = useState(false);
  const [gradientBg, setGradientBg] = useState('');

  // ------------------------------
  // LocalStorage bootstrap (fallback)
  // ------------------------------
  useEffect(() => {
    const taste = JSON.parse(localStorage.getItem('tasteAnswers'));
    if (Array.isArray(taste)) setTasteAnswers(taste);
    const favs = JSON.parse(localStorage.getItem('favoriteFilms'));
    if (Array.isArray(favs)) setFavoriteFilms(favs);
    const bioStored = localStorage.getItem('userBio');
    const clubStored = localStorage.getItem('userClub');
    const bannerStored = localStorage.getItem('userBanner');
    const avatarStored = localStorage.getItem('userAvatar');
    const gradientStored = localStorage.getItem('userGradient');
    const gradientToggle = localStorage.getItem('useGradient');
    const nameStored = localStorage.getItem('userName');
    const usernameStored = localStorage.getItem('userUsername');

    if (bioStored) setBio(bioStored);
    if (clubStored) setClubName(clubStored);
    if (bannerStored) setBannerImage(bannerStored);
    if (avatarStored) setAvatarPreview(avatarStored);
    if (gradientStored) setGradientBg(gradientStored);
    if (nameStored) setName(nameStored);
    if (usernameStored) setUsername(usernameStored);
    setUseGlowStyle(localStorage.getItem('useGlowStyle') !== 'false');
    setUseGradient(gradientToggle !== 'false');
  }, []);

  // ------------------------------
  // Supabase hydrate (overrides local values if found)
  // ------------------------------
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user || !user.id) return; // not signed in → skip
      const { data, error } = await supabase
        .from('profiles')
        .select('name, username, bio, club, banner_image, gradient_bg, use_gradient, avatar, taste_cards, favorite_films')
        .eq('id', user.id)
        .single();

      if (error) {
        // If row doesn't exist, we just keep localStorage values and create row on first save
        return;
      }
      if (!data) return;

      if (data.name) setName(data.name);
      if (data.username) setUsername(data.username);
      if (data.bio) setBio(data.bio);
      if (data.club) setClubName(data.club);
      if (data.banner_image) setBannerImage(data.banner_image);
      if (typeof data.use_gradient === 'boolean') setUseGradient(data.use_gradient);
      if (data.gradient_bg) setGradientBg(data.gradient_bg);
      if (data.avatar) {
        setAvatarPreview(data.avatar);
        setAvatar(data.avatar);
      }
      if (Array.isArray(data.taste_cards)) setTasteAnswers(data.taste_cards);
      if (Array.isArray(data.favorite_films)) setFavoriteFilms(data.favorite_films);
    };

    fetchProfile();
  }, [user, setAvatar]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldEdit = params.get('edit') === 'true';
    if (shouldEdit && !editMode) {
      setEditMode(true);
      setEditingTasteCards([...tasteAnswers]);
      params.delete('edit');
      navigate({ search: params.toString() }, { replace: true });
    }
  }, [location.search, editMode, tasteAnswers, navigate]);

  const cleanTasteCards = (cards) => {
    const seen = new Set();
    return cards
      .filter(card =>
        card && card.question && typeof card.answer === 'string' &&
        card.answer.trim() !== '' && questionList.includes(card.question) &&
        !seen.has(card.question)
      )
      .map(card => {
        seen.add(card.question);
        return {
          question: card.question,
          answer: card.answer.trim(),
          glowClass: card.glowClass || glowOptions.free[0].class
        };
      })
      .slice(0, 4);
  };

  // ------------------------------
  // Save: LocalStorage + Supabase
  // ------------------------------
  const toggleEditMode = async () => {
    if (editMode) {
      const finalized = cleanTasteCards(editingTasteCards);
      setTasteAnswers(finalized);

      // ✅ LocalStorage persists for quick reloads/offline
      localStorage.setItem('tasteAnswers', JSON.stringify(finalized));
      localStorage.setItem('favoriteFilms', JSON.stringify(favoriteFilms));
      localStorage.setItem('useGradient', useGradient);
      localStorage.setItem('userBio', bio);
      localStorage.setItem('userClub', clubName);
      localStorage.setItem('userBanner', bannerImage);
      localStorage.setItem('userName', name);
      localStorage.setItem('userAvatar', avatarPreview);
      localStorage.setItem('userGradient', gradientBg);
      localStorage.setItem('userUsername', username);
      localStorage.setItem('useGlowStyle', String(useGlowStyle));

      // ✅ Supabase persist for cross-device sync
      try {
        if (user && user.id) {
          // upsert ensures row exists (creates if missing)
          const { error } = await supabase
            .from('profiles')
            .upsert(
              {
                id: user.id,
                name,
                username,
                bio,
                club: clubName,
                banner_image: bannerImage,
                gradient_bg: gradientBg,
                use_gradient: useGradient,
                avatar: avatarPreview,
                taste_cards: finalized,
                favorite_films: favoriteFilms,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id' }
            );

          if (error) {
            console.error('Supabase save error:', error.message);
            // optional: toast UI here
          }
        }
      } catch (e) {
        console.error('Supabase save exception:', e);
      }
    }

    setEditMode(!editMode);
    setShowBannerPicker(false);
  };

  const handleUsernameChange = (newUsername) => {
    const lastChange = localStorage.getItem('usernameLastChanged');
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (!lastChange || now - Number(lastChange) > ninetyDays) {
      setUsername(newUsername);
      localStorage.setItem('userUsername', newUsername);
      localStorage.setItem('usernameLastChanged', String(now));
    } else {
      alert("You can only change your username once every 90 days.");
    }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRawAvatarImage(reader.result);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = (croppedImageUrl) => {
    setAvatarPreview(croppedImageUrl);
    setAvatar(croppedImageUrl);
    localStorage.setItem('userAvatar', croppedImageUrl);
    setShowCropper(false);
  };

  const handleFilmSelect = (film) => {
    if (!film || !film.title || typeof film.poster_path !== 'string' || !film.poster_path.startsWith('/')) return;
    const newFilm = { title: film.title, posterPath: film.poster_path, id: film.id, glowClass: glowOptions.free[0]?.class || '' };
    setFavoriteFilms(prev => {
      const exists = prev.some(f => f.title === newFilm.title);
      if (!exists && prev.length < 8) return [...prev, newFilm];
      return prev;
    });
  };

  return (
    <div className="w-full text-white py-8 px-4 bg-black">
      <div className="max-w-6xl mx-auto bg-black rounded-2xl overflow-hidden shadow-lg">
        <div
          className="relative w-full h-[500px] group"
          style={{ backgroundImage: bannerImage ? `url(${bannerImage})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}
        >
          <div className="absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-60 transition" />
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-b from-transparent to-black pointer-events-none" />

          {profileUser.isCurrentUser && !editMode && (
            <button
              onClick={toggleEditMode}
              className="absolute top-4 right-4 z-20 bg-black/70 text-white text-sm px-4 py-2 rounded-full hover:bg-black/90 transition"
            >
              ✏️ Edit Profile
            </button>
          )}

          {/* ✅ Done Editing button (only visible in edit mode) */}
          {editMode && (
            <button
              onClick={toggleEditMode}
              className="absolute top-4 right-4 z-20 bg-yellow-400 text-black text-sm px-4 py-2 rounded-full hover:bg-yellow-300 transition"
            >
              ✅ Done Editing
            </button>
          )}

          {editMode && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <button
                onClick={() => setShowBannerPicker(true)}
                className="bg-black/60 hover:bg-black/80 text-white rounded-full p-3"
              >
                📷 Change Banner
              </button>
            </div>
          )}
          <div className="absolute bottom-0 left-0 w-full px-6 pb-6 z-10 flex items-end">
            <div className="flex items-end space-x-4 max-w-3xl w-full">
              <div className="relative w-24 h-24 shrink-0">
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  onError={(e) => { e.target.onerror = null; e.target.src = "/avatars/default.jpg"; }}
                  className="w-full h-full rounded-full border-4 border-black object-cover"
                />
                {editMode && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition">
                    <label htmlFor="avatar-upload" className="cursor-pointer text-white text-lg">📷</label>
                    <input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </div>
                )}
              </div>
              <div className="w-full">
                {editMode ? (
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="text-xl font-bold bg-zinc-800/40 p-1 rounded w-full"
                  />
                ) : (
                  <h2 className="text-xl font-bold">{name}</h2>
                )}
                {editMode ? (
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    className="text-sm text-gray-300 bg-zinc-800/40 p-1 rounded w-full mt-1"
                  />
                ) : (
                  <p className="text-sm text-gray-300">@{username}</p>
                )}
                <ClubBadge clubName={clubName} />
                {editMode ? (
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={2}
                    className="mt-1 text-sm text-white bg-zinc-800/40 p-2 rounded w-full resize-none"
                  />
                ) : (
                  <p className="mt-1 text-sm text-gray-200">{bio}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <StatsAndWatchlist />
        {showBannerPicker && (
          <div className="px-6 pt-6">
            <BannerPicker
              onSelect={({ image, gradient }) => {
                setBannerImage(image);
                setGradientBg(gradient);
                setShowBannerPicker(false);
              }}
            />
          </div>
        )}
        {showCropper && rawAvatarImage && (
          <AvatarCropper
            imageSrc={rawAvatarImage}
            onCropComplete={handleCropComplete}
            onCancel={() => setShowCropper(false)}
          />
        )}
        {editMode && (
          <div className="px-6 pt-6 flex items-center gap-2 text-white">
            <span role="img" aria-label="camera">🎬</span>
            <h3 className="text-white font-semibold text-sm">
              Add your favorite films — the ones that made you feel something.
            </h3>
          </div>
        )}

        <div className="px-6 pt-6 w-1/2">
          <FavoriteFilmsGrid
            films={favoriteFilms}
            setFilms={setFavoriteFilms}
            onFilmSelect={handleFilmSelect}
            editMode={editMode}
            useGlowStyle={useGlowStyle}
          />
        </div>

        {editMode && <div className="px-6 pt-6"><FilmSearch onSelect={handleFilmSelect} /></div>}
        {editMode && (
          <div className="px-6 pt-8">
            <TasteCardPicker
              selected={editingTasteCards}
              setSelected={setEditingTasteCards}
              useGlowStyle={useGlowStyle}
              setUseGlowStyle={setUseGlowStyle}
            />
          </div>
        )}
        {!editMode && tasteAnswers.length > 0 && (
          <div className="mt-10 px-6">
            <h3 className="text-lg font-semibold mb-4">Taste Questions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {tasteAnswers.map((item, index) => {
                const glow = glowOptions.free.find(g => g.class === item.glowClass);
                return (
                  <TasteCard
                    key={index}
                    question={item.question}
                    answer={item.answer}
                    glowColor={glow?.color || '#FF0000'}
                    glowStyle={glow?.glow || 'none'}
                    useGlowStyle={useGlowStyle}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;











