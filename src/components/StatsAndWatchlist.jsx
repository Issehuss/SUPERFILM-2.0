// components/StatsAndWatchlist.jsx

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const statsSequence = [
  { label: 'Followers', value: 124 },
  { label: 'Following', value: 87 },
  { label: 'Films Watched', value: 342 },
];

const StatsAndWatchlist = () => {
  const [currentStatIndex, setCurrentStatIndex] = useState(0);
  const [watchlist, setWatchlist] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStatIndex((prev) => (prev + 1) % statsSequence.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('watchlist'));
      if (Array.isArray(saved)) setWatchlist(saved);
    } catch {
      setWatchlist([]);
    }
  }, []);

  return (
    <div className="w-full px-6 pt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Animated Stats Card */}
      <motion.div
        className="bg-zinc-900 rounded-2xl shadow-md p-6 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStatIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="text-white"
          >
            <p className="text-sm text-gray-400">{statsSequence[currentStatIndex].label}</p>
            <p className="text-2xl font-bold text-cyan-300">{statsSequence[currentStatIndex].value}</p>
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Watchlist Display */}
      <div className="md:col-span-2 bg-zinc-900 rounded-2xl shadow-md p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Watchlist</h3>
        {watchlist.length === 0 ? (
          <p className="text-gray-400 text-sm">No films added to your watchlist yet.</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {watchlist.map((film) => (
              <div
                key={film.id}
                onClick={() => navigate(`/movie/${film.id}`)}
                className="w-20 h-28 rounded-md overflow-hidden shadow hover:scale-105 transition-transform duration-200 cursor-pointer"
              >
                <img
                  src={`https://image.tmdb.org/t/p/w500${film.posterPath}`}
                  alt={film.title}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsAndWatchlist;


