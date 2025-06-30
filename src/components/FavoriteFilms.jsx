// Full updated FavoriteFilms.jsx with glow picker, bidirectional cycling, and solid outline toggle

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
  const cycleGlowForward = (index) => {
    if (!setFavoriteFilms) return;
    setFavoriteFilms((prev) => {
      const updated = [...prev];
      const current = glowOptions.free.findIndex(g => g.class === updated[index].glowClass);
      const nextIndex = (current + 1) % glowOptions.free.length;
      updated[index].glowClass = glowOptions.free[nextIndex].class;
      return updated;
    });
  };

  const cycleGlowBackward = (index) => {
    if (!setFavoriteFilms) return;
    setFavoriteFilms((prev) => {
      const updated = [...prev];
      const current = glowOptions.free.findIndex(g => g.class === updated[index].glowClass);
      const prevIndex = (current - 1 + glowOptions.free.length) % glowOptions.free.length;
      updated[index].glowClass = glowOptions.free[prevIndex].class;
      return updated;
    });
  };

  return (
    <div className="px-6 pt-8">
      {films.length === 0 ? (
        <p className="text-gray-400">No favorite films yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <AnimatePresence>
            {films.map((film, index) => {
              const glowClass = useGlowStyle ? film.glowClass || '' : '';
              return (
                <motion.div
                  key={film.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`relative rounded-lg overflow-hidden cursor-pointer ${glowClass} ${enableHoverEffect ? 'hover:scale-105 transition-transform duration-200' : ''}`}
                  onClick={() => enableNavigation && onFilmClick(film.id)}
                >
                  <img
                    src={`https://image.tmdb.org/t/p/w500${film.posterPath}`}
                    alt={film.title}
                    className="w-full h-[278px] object-cover"
                  />

                  {editMode && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(film.title);
                        }}
                        className="absolute top-2 right-2 bg-black bg-opacity-60 text-white rounded-full px-2 hover:bg-red-600"
                      >
                        ✕
                      </button>

                      {useGlowStyle && (
                        <div className="absolute bottom-2 left-2 flex space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cycleGlowBackward(index);
                            }}
                            className="bg-black bg-opacity-60 text-white rounded-full px-2 hover:bg-blue-500 text-sm"
                          >
                            ←
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cycleGlowForward(index);
                            }}
                            className="bg-black bg-opacity-60 text-white rounded-full px-2 hover:bg-blue-500 text-sm"
                          >
                            →
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default FavoriteFilms;

















