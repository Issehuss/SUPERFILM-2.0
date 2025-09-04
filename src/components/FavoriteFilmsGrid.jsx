// ✅ FAVORITE FILMS GRID COMPONENT: Hover Pop + Pagination + Click Navigation (Larger 2x2 Grid with Glow Options + White Outline)
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { glowOptions } from '../constants/glowOptions';

const FavoriteFilmsGrid = ({ films, setFilms, onFilmSelect, editMode, useGlowStyle }) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const pageSize = 4;
  const maxPage = Math.ceil(films.length / pageSize) - 1;

  const handleClick = (filmId) => {
    if (!editMode) {
      navigate(`/movie/${filmId}`);
    }
  };

  const handlePrev = () => {
    setPage((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setPage((prev) => Math.min(maxPage, prev + 1));
  };

  const cycleGlow = (index, direction) => {
    const currentIndex = glowOptions.free.findIndex(opt => opt.class === films[index].glowClass);
    const total = glowOptions.free.length;
    const nextIndex = (currentIndex + direction + total) % total;
    const newGlow = glowOptions.free[nextIndex].class;

    const updated = [...films];
    updated[index].glowClass = newGlow;
    setFilms(updated);
  };

  const currentFilms = films.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="flex flex-col items-start space-y-2">
      <div className="grid grid-cols-2 gap-[6px]">
        {currentFilms.map((film, idx) => {
          const globalIndex = page * pageSize + idx;
          return (
            <div
              key={film.id}
              onClick={() => handleClick(film.id)}
              className={`relative cursor-pointer transform transition duration-300 hover:scale-110 rounded overflow-hidden border ${useGlowStyle ? film.glowClass : 'border-white'} w-[96px] h-[144px]`}
            >
              <img
                src={`https://image.tmdb.org/t/p/w500${film.posterPath}`}
                alt={film.title}
                className="w-full h-full object-cover"
              />
              {editMode && useGlowStyle && (
                <div className="absolute bottom-1 left-1 flex space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      cycleGlow(globalIndex, -1);
                    }}
                    className="bg-black/60 text-white text-xs px-1 rounded hover:bg-blue-600"
                  >←</button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      cycleGlow(globalIndex, 1);
                    }}
                    className="bg-black/60 text-white text-xs px-1 rounded hover:bg-blue-600"
                  >→</button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {films.length > pageSize && (
        <div className="flex justify-center space-x-4 mt-1">
          <button onClick={handlePrev} disabled={page === 0} className="text-white text-xl hover:scale-125 transition-transform">←</button>
          <button onClick={handleNext} disabled={page === maxPage} className="text-white text-xl hover:scale-125 transition-transform">→</button>
        </div>
      )}
    </div>
  );
};

export default FavoriteFilmsGrid;




