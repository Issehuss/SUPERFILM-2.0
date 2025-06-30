// FavoriteFilms.jsx
import React from 'react';

const FavoriteFilms = ({ films }) => {
  return (
    <div className="w-full px-4 md:px-8 mt-10">
      <h3 className="text-xl font-semibold mb-4">🎞️ Favorite Films</h3>

      <div className="flex overflow-x-auto space-x-4 pb-2">
        {films.map((film, index) => (
          <div
            key={index}
            className="min-w-[150px] flex-shrink-0 rounded overflow-hidden shadow-md"
          >
            <img
              src={film.poster}
              alt={film.title}
              className="w-full h-auto object-cover rounded"
            />
            <p className="mt-1 text-sm text-gray-300 truncate">{film.title}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FavoriteFilms;
