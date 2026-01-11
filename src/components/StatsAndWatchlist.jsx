// src/components/StatsAndWatchlist.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import useWatchlist from "../hooks/useWatchlist";
import TmdbImage from "./TmdbImage";

export default function StatsAndWatchlist({ statsData, userId, movieRoute = "/movies", onFollowersClick, onFollowingClick }) {
    // premium check (passed implicitly via theme)
    const isPremium = Boolean(statsData?.isPremium);

  const navigate = useNavigate();

  // ---- Stats inputs ----
  const followers = statsData?.followers ?? 0;
  const following = statsData?.following ?? 0;
  const role = null;
  const roleClub = null;

  // ---- Watchlist ----
  const { items: watchlist = [] } = useWatchlist?.() ?? { items: [] };

  const posterUrl = (m) => {
    // accepts { poster_path } or direct url; supports { tmdb_id } if needed
    if (m?.poster_path) {
      return m.poster_path.startsWith("http")
        ? m.poster_path
        : `https://image.tmdb.org/t/p/w342${m.poster_path}`;
    }
    if (m?.posterPath) return m.posterPath;
    return "";
  };

  const movieId = (m) => m?.id ?? m?.tmdb_id ?? m?.movie_id ?? null;

   const goMovie = (m) => {
    const id = movieId(m);
    if (!id) return;
    navigate(`${movieRoute}/${id}`);
  };

  const goWatchlist = () => {
    navigate("/watchlist");
  };

  return (
    <div className="w-full px-0 sm:px-6 pt-4 sm:pt-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
        {/* LEFT: Stats (centered) */}
        <div
          className={
            isPremium
              ? "themed-card themed-outline forge rounded-none sm:rounded-2xl p-4 sm:p-5 w-full"
              : "rounded-none border-t border-b border-zinc-900 bg-black/50 p-4 sm:p-5 sm:rounded-2xl sm:border sm:border-zinc-800"
          }
        >

          <div className="flex flex-col items-center gap-2">
            <div className="mt-1 grid grid-cols-2 gap-4 sm:gap-6 text-center">
              <button
                type="button"
                onClick={onFollowersClick}
                className="flex flex-col items-center gap-1 focus:outline-none"
              >
                <div className="text-zinc-400 text-xs uppercase tracking-wide">
                  Followers
                </div>
                <div className="text-xl sm:text-2xl font-semibold">{followers}</div>
              </button>
              <button
                type="button"
                onClick={onFollowingClick}
                className="flex flex-col items-center gap-1 focus:outline-none"
              >
                <div className="text-zinc-400 text-xs uppercase tracking-wide">
                  Following
                </div>
                <div className="text-xl sm:text-2xl font-semibold">{following}</div>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Watchlist */}
        <div
          className={
            isPremium
              ? "themed-card themed-outline forge rounded-none sm:rounded-2xl p-4 sm:p-5 w-full"
              : "rounded-none border-t border-b border-zinc-900 bg-black/50 p-4 sm:p-5 sm:rounded-2xl sm:border sm:border-zinc-800"
          }
        >

          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h3 className="text-sm font-semibold text-white/90">Watchlist</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400">{watchlist.length}</span>
              <button
                type="button"
                onClick={goWatchlist}
                className="text-[11px] uppercase tracking-wide text-zinc-400 hover:text-white transition"
              >
                View all
              </button>
            </div>
          </div>

          {watchlist.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
              {watchlist.map((m) => {
                const poster = posterUrl(m);
                const id = movieId(m);
                return (
                  <button
                    key={id || poster}
                    onClick={() => goMovie(m)}
                    className="group w-[72px] h-[108px] rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900/40 shrink-0 transition-transform hover:scale-[1.03] focus:scale-[1.03]"
                    title={m?.title || ""}
                  >
                    {poster ? (
                      <TmdbImage
                        src={poster}
                        alt={m?.title || "Poster"}
                        className="w-full h-full"
                        imgClassName="transition-transform group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src =
                            "data:image/svg+xml;charset=utf-8," +
                            encodeURIComponent(
                              `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='180'><rect width='100%' height='100%' fill='#111'/></svg>`
                            );
                        }}
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-xs text-zinc-500">
                        No image
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="h-[96px] sm:h-[108px] grid place-items-center text-sm text-zinc-400">
              Your watchlist is empty.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
