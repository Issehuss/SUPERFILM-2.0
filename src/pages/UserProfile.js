// UserProfile.jsx

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import StatsAndWatchlist from '../components/StatsAndWatchlist';
import FavoriteFilms from '../components/FavoriteFilms';
import FilmSearch from '../components/FilmSearch';
import TasteCard from '../components/TasteCard';
import TasteCardPicker from '../components/TasteCardPicker';
import ClubBadge from '../components/ClubBadge';
import BannerPicker from '../components/BannerPicker';
import AvatarCropper from '../components/AvatarCropper';
import { questionList } from '../constants/tasteQuestions';
import { glowOptions } from '../constants/glowOptions';
import { useUser } from '../context/UserContext';

const UserProfile = ({ user }) => {
  const fallbackUser = {
    name: "Ava Rahimi",
    username: "cinemaava",
    avatar: "/avatars/ava.jpg",
    bannerImage: "/banners/decision.jpeg",
    bio: "Lover of quiet films where nothing happens. Taste of Cherry made me cry in silence.",
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
  const [avatarPreview, setAvatarPreview] = useState(() => localStorage.getItem('userAvatar') || profileUser.avatar);
  const [bannerImage, setBannerImage] = useState(() => localStorage.getItem('userBanner') || profileUser.bannerImage);
  const [bio, setBio] = useState(() => localStorage.getItem('userBio') || profileUser.bio);
  const [clubName, setClubName] = useState(() => localStorage.getItem('userClub') || profileUser.club);
  const [rawAvatarImage, setRawAvatarImage] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  const [useGlowStyle, setUseGlowStyle] = useState(() => localStorage.getItem('useGlowStyle') !== 'false');
  useEffect(() => { localStorage.setItem('useGlowStyle', useGlowStyle); }, [useGlowStyle]);

  const [useFilmGlowStyle, setUseFilmGlowStyle] = useState(() => localStorage.getItem('useFilmGlowStyle') !== 'false');
  useEffect(() => { localStorage.setItem('useFilmGlowStyle', useFilmGlowStyle); }, [useFilmGlowStyle]);

  useEffect(() => { localStorage.setItem('userBio', bio); }, [bio]);
  useEffect(() => { localStorage.setItem('userClub', clubName); }, [clubName]);
  useEffect(() => { localStorage.setItem('userBanner', bannerImage); }, [bannerImage]);

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
    setShowCropper(false);
  };

  const [favoriteFilms, setFavoriteFilms] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('favoriteFilms'));
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  useEffect(() => { localStorage.setItem('favoriteFilms', JSON.stringify(favoriteFilms)); }, [favoriteFilms]);

  const [tasteAnswers, setTasteAnswers] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('tasteAnswers'));
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  useEffect(() => { localStorage.setItem('tasteAnswers', JSON.stringify(tasteAnswers)); }, [tasteAnswers]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setEditMode(params.get("edit") === "true");
  }, [location.search]);

  useEffect(() => {
    if (editMode && editingTasteCards.length === 0 && tasteAnswers.length > 0) {
      setEditingTasteCards(tasteAnswers);
    }
  }, [editMode, tasteAnswers, editingTasteCards.length]);

  const cleanTasteCards = (cards) => {
    const seen = new Set();
    return cards.filter(card =>
      card && card.question && typeof card.answer === 'string' &&
      card.answer.trim() !== '' && questionList.includes(card.question) &&
      !seen.has(card.question)
    ).map(card => {
      seen.add(card.question);
      return {
        question: card.question,
        answer: card.answer.trim(),
        glowClass: card.glowClass || glowOptions.free[0].class
      };
    }).slice(0, 4);
  };

  const toggleEditMode = () => {
    if (editMode) {
      const finalized = cleanTasteCards(editingTasteCards);
      setTasteAnswers(finalized);
      localStorage.setItem('tasteAnswers', JSON.stringify(finalized));
    } else {
      setEditingTasteCards(tasteAnswers);
    }
    setEditMode(!editMode);
    setShowBannerPicker(false);
  };

  const handleFilmSelect = (film) => {
    const newFilm = {
      title: film.title,
      posterPath: film.poster_path,
      id: film.id,
      glowClass: glowOptions.free[0]?.class || ''
    };
    if (!favoriteFilms.some((f) => f.title === newFilm.title)) {
      setFavoriteFilms([newFilm, ...favoriteFilms]);
    }
  };

  const handleFilmClick = (id) => {
    if (!editMode) {
      navigate(`/movie/${id}`);
    }
  };

  return (
    <div className="w-full bg-black text-white py-8 px-4">
      <div className="max-w-6xl mx-auto bg-black rounded-2xl overflow-hidden shadow-lg">
        {/* Banner */}
        <div className="relative w-full h-[500px] group" style={{ backgroundImage: `url(${bannerImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className="absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-60 transition" />
          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-b from-transparent to-black pointer-events-none" />
          {editMode && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <button onClick={() => setShowBannerPicker(true)} className="bg-black/60 hover:bg-black/80 text-white rounded-full p-3">📷 Change Banner</button>
            </div>
          )}
          <div className="absolute bottom-0 left-0 w-full px-6 pb-6 z-10 flex items-end">
            <div className="flex items-end space-x-4 max-w-3xl w-full">
              <div className="relative w-24 h-24 shrink-0">
                <img src={avatarPreview} alt="Avatar" className="w-full h-full rounded-full border-4 border-black object-cover" />
                {editMode && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition">
                    <label htmlFor="avatar-upload" className="cursor-pointer text-white text-lg">📷</label>
                    <input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                  </div>
                )}
              </div>
              <div className="w-full">
                <h2 className="text-xl font-bold">{profileUser.name}</h2>
                <p className="text-sm text-gray-300">@{profileUser.username}</p>
                <ClubBadge clubName={clubName} />
                {editMode ? (
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="mt-1 text-sm text-white bg-zinc-800/40 p-2 rounded w-full resize-none" />
                ) : (
                  <p className="mt-1 text-sm text-gray-200">{bio}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 👇 Stats + Watchlist inserted here */}
        <StatsAndWatchlist />

        {showBannerPicker && <div className="px-6 pt-6"><BannerPicker onSelect={(url) => { setBannerImage(url); setShowBannerPicker(false); }} /></div>}
        {showCropper && rawAvatarImage && <AvatarCropper imageSrc={rawAvatarImage} onCropComplete={handleCropComplete} onCancel={() => setShowCropper(false)} />}
        {editMode && <div className="flex justify-end px-6 mt-6"><button onClick={toggleEditMode} className="bg-gradient-to-r from-yellow-500 to-pink-500 text-white font-semibold px-5 py-2 rounded-full shadow-md hover:from-yellow-400 hover:to-pink-400 transition">✅ Done Editing</button></div>}
        {editMode && <div className="px-6 pt-8"><FilmSearch onSelect={handleFilmSelect} /></div>}

        {/* Favorite Films */}
        <div className="flex justify-between items-center px-6 pt-6">
          <h2 className="text-2xl font-bold text-white">Favorite Films</h2>
          {editMode && (
            <label className="flex items-center text-sm text-white space-x-2">
              <input type="checkbox" checked={useFilmGlowStyle} onChange={() => setUseFilmGlowStyle(!useFilmGlowStyle)} className="form-checkbox" />
              <span>Use Glow Style</span>
            </label>
          )}
        </div>

        <FavoriteFilms
          films={favoriteFilms}
          editMode={editMode}
          setFavoriteFilms={setFavoriteFilms}
          onRemove={(titleToRemove) => setFavoriteFilms(favoriteFilms.filter((f) => f.title !== titleToRemove))}
          useGlowStyle={useFilmGlowStyle}
          enableHoverEffect={!editMode}
          enableNavigation={!editMode}
          onFilmClick={handleFilmClick}
        />

        {/* Taste Cards */}
        {editMode && <div className="px-6 pt-8"><TasteCardPicker selected={editingTasteCards} setSelected={setEditingTasteCards} useGlowStyle={useGlowStyle} setUseGlowStyle={setUseGlowStyle} /></div>}
        {!editMode && tasteAnswers.length > 0 && (
          <div className="mt-10 px-6">
            <h3 className="text-lg font-semibold mb-4">Taste Questions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {tasteAnswers.map((item, index) => {
                const glow = glowOptions.free.find(g => g.class === item.glowClass);
                return <TasteCard key={index} question={item.question} answer={item.answer} glowColor={glow?.color || '#FF0000'} glowStyle={glow?.glow || 'none'} useGlowStyle={useGlowStyle} />;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;























