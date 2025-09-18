// src/components/FavoriteFilms.jsx
import React from "react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import { glowOptions } from "../constants/glowOptions";

const FavoriteFilms = ({
  films,
  editMode,
  setFavoriteFilms,
  onRemove,
  useGlowStyle,
  enableHoverEffect,
  enableNavigation,
  onFilmClick,
}) => {
  if (!Array.isArray(films)) return null;

  const cycleGlow = (index, direction) => {
    if (!setFavoriteFilms || !glowOptions?.free?.length) return;
    setFavoriteFilms((prev = []) => {
      if (!prev[index]) return prev;
      const updated = [...prev];
      const list = glowOptions.free;

      const currentIdx = list.findIndex((g) => g.class === updated[index].glowClass);
      const safeCurrent = currentIdx === -1 ? 0 : currentIdx;
      const nextIdx = (safeCurrent + direction + list.length) % list.length;

      updated[index] = { ...updated[index], glowClass: list[nextIdx].class };
      return updated;
    });
  };

  return (
    <div className="flex gap-4 flex-wrap mt-4 px-6">
      <AnimatePresence>
        {films.map((film, index) => {
          const posterPath = film?.posterPath;
          if (!posterPath || typeof posterPath !== "string") return null;

          const glowClass = useGlowStyle ? film.glowClass || "" : "";

          return (
            <motion.div
              key={film.id || film.title || index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`relative w-32 sm:w-40 rounded overflow-hidden ${glowClass} ${
                enableHoverEffect ? "hover:scale-105 transition-transform" : ""
              }`}
              onClick={() => enableNavigation && onFilmClick?.(film.id)}
            >
              <img
                loading="lazy"
                decoding="async"
                src={`https://image.tmdb.org/t/p/w500${posterPath}`}
                alt={film.title || "Poster"}
                className="w-full h-[278px] object-cover"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/fallback/poster.jpg";
                }}
              />

              {editMode && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove?.(film.title);
                    }}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full px-2 hover:bg-red-600"
                    aria-label={`Remove ${film.title || "film"}`}
                  >
                    ✕
                  </button>

                  {useGlowStyle && (
                    <div className="absolute bottom-2 left-2 flex space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleGlow(index, -1);
                        }}
                        className="bg-black/60 text-white rounded-full px-2"
                        aria-label="Previous glow"
                      >
                        ←
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          cycleGlow(index, 1);
                        }}
                        className="bg-black/60 text-white rounded-full px-2"
                        aria-label="Next glow"
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
  );
};

FavoriteFilms.propTypes = {
  films: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      title: PropTypes.string,
      posterPath: PropTypes.string, // required by renderer (camelCase)
      glowClass: PropTypes.string,
    })
  ),
  editMode: PropTypes.bool,
  setFavoriteFilms: PropTypes.func,
  onRemove: PropTypes.func,
  useGlowStyle: PropTypes.bool,
  enableHoverEffect: PropTypes.bool,
  enableNavigation: PropTypes.bool,
  onFilmClick: PropTypes.func,
};

FavoriteFilms.defaultProps = {
  films: [],
  editMode: false,
  useGlowStyle: true,
  enableHoverEffect: true,
  enableNavigation: false,
};

export default FavoriteFilms;
