import React from 'react';

const FavoriteFilms = ({
  films = [],
  editMode,
  setFavoriteFilms,
  onRemove,
  useGlowStyle,
  enableHoverEffect,
  enableNavigation,
  onFilmClick,
}) => {
  const handleRemove = (title) => {
    const updated = films.filter((f) => f.title !== title);
    setFavoriteFilms(updated);
    if (onRemove) onRemove(title);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
      {films.map((film, index) => (
        <div
          key={index}
          className={`relative group cursor-pointer transition transform hover:scale-105`}
          onClick={() => {
            if (!editMode && enableNavigation && onFilmClick) {
              onFilmClick(film.id);
            }
          }}
        >
          <img
            src={`https://image.tmdb.org/t/p/w342${film.posterPath}`}
            alt={film.title}
            className={`w-full h-auto rounded-lg shadow-md ${
              enableHoverEffect ? 'group-hover:opacity-80' : ''
            }`}
          />
          {useGlowStyle && (
            <div className={`absolute inset-0 ${film.glowClass} rounded-lg pointer-events-none`} />
          )}
          {editMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(film.title);
              }}
              className="absolute top-1 right-1 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full px-2 py-1 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export default FavoriteFilms;



















