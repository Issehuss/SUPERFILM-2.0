// src/components/StatsAndWatchlist.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import RolePill from "./RolePill.jsx";
import useWatchlist from "../hooks/useWatchlist";

export default function StatsAndWatchlist({ statsData, userId, movieRoute = "/movies" }) {
  const navigate = useNavigate();

  // ---- Stats inputs ----
  const followers = statsData?.followers ?? 0;
  const following = statsData?.following ?? 0;
  const role = statsData?.role ?? null;
  const roleClub = statsData?.roleClub ?? null; // { club_slug, club_name, club_id }

  // ---- Watchlist ----
  const { items: watchlist = [] } = useWatchlist?.() ?? { items: [] };

  const goClub = () => {
    if (!roleClub?.club_slug) return;
    navigate(`/clubs/${roleClub.club_slug}`);
  };

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

  return (
    <div className="px-6 pt-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT: Stats (centered) */}
        <div className="rounded-2xl border border-zinc-800 bg-black/50 p-5">
          <div className="flex flex-col items-center gap-2">
            {/* Clickable role pill (only if present) */}
            {role ? (
              <button
                onClick={goClub}
                className="cursor-pointer focus:outline-none"
                title={roleClub?.club_name || "View club"}
              >
                <RolePill role={role} />
              </button>
            ) : null}

            {/* Centered numbers */}
            <div className="mt-2 grid grid-cols-2 gap-6 text-center">
              <div>
                <div className="text-zinc-400 text-xs uppercase tracking-wide">
                  Followers
                </div>
                <div className="text-2xl font-semibold">{followers}</div>
              </div>
              <div>
                <div className="text-zinc-400 text-xs uppercase tracking-wide">
                  Following
                </div>
                <div className="text-2xl font-semibold">{following}</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Watchlist */}
        <div className="rounded-2xl border border-zinc-800 bg-black/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white/90">Watchlist</h3>
            <span className="text-xs text-zinc-400">{watchlist.length}</span>
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
                      <img
                        src={poster}
                        alt={m?.title || "Poster"}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
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
            <div className="h-[108px] grid place-items-center text-sm text-zinc-400">
              Your watchlist is empty.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
