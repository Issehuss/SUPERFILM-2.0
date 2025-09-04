// FavoriteFilms.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { glowOptions } from '../constants/glowOptions';

const FavoriteFilms = ({
  films,
  editMode,
  setFavoriteFilms,
  onRemove,
  useGlowStyle,
  enableHoverEffect,
  enableNavigation,
  onFilmClick
}) => {
  if (!Array.isArray(films)) return null;

  const cycleGlow = (index, direction) => {
    if (!setFavoriteFilms) return;
    setFavoriteFilms(prev => {
      const updated = [...prev];
      const currentIdx = glowOptions.free.findIndex(g => g.class === updated[index].glowClass);
      const nextIdx = (currentIdx + direction + glowOptions.free.length) % glowOptions.free.length;
      updated[index].glowClass = glowOptions.free[nextIdx].class;
      return updated;
    });
  };

  return (
    <div className="flex gap-4 flex-wrap mt-4 px-6">
      <AnimatePresence>
        {films.map((film, index) => {
          if (!film?.posterPath || typeof film.posterPath !== 'string') return null;

          const glowClass = useGlowStyle ? film.glowClass || '' : '';
          return (
            <motion.div
              key={film.id || film.title || index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`relative w-32 sm:w-40 rounded overflow-hidden ${glowClass} ${enableHoverEffect ? 'hover:scale-105 transition-transform' : ''}`}
              onClick={() => enableNavigation && onFilmClick(film.id)}
            >
              <img
                src={`https://image.tmdb.org/t/p/w500${film.posterPath}`}
                alt={film.title}
                className="w-full h-[278px] object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/fallback/poster.jpg';
                }}
              />

              {editMode && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(film.title);
                    }}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full px-2 hover:bg-red-600"
                  >
                    ✕
                  </button>

                  {useGlowStyle && (
                    <div className="absolute bottom-2 left-2 flex space-x-1">
                      <button onClick={(e) => { e.stopPropagation(); cycleGlow(index, -1); }} className="bg-black/60 text-white rounded-full px-2">←</button>
                      <button onClick={(e) => { e.stopPropagation(); cycleGlow(index, 1); }} className="bg-black/60 text-white rounded-full px-2">→</button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default FavoriteFilms;




