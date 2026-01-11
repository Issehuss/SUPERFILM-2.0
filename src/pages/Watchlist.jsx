// src/pages/Watchlist.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  LayoutGrid,
  List,
  Search,
  Shuffle,
  X,
} from "lucide-react";
import { useUser } from "../context/UserContext";
import useWatchlist from "../hooks/useWatchlist";
import TmdbImage from "../components/TmdbImage";

const MOVIE_ROUTE = "/movie";

function posterUrl(m) {
  if (m?.poster_path) {
    return m.poster_path.startsWith("http")
      ? m.poster_path
      : `https://image.tmdb.org/t/p/w780${m.poster_path}`;
  }
  if (m?.posterPath) return m.posterPath;
  return "";
}

export default function Watchlist() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { items = [], loading, error, remove } = useWatchlist();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState("grid");

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const base = trimmed
      ? items.filter((m) => (m?.title || "").toLowerCase().includes(trimmed))
      : items;

    if (sort === "title") {
      return [...base].sort((a, b) =>
        (a?.title || "").localeCompare(b?.title || "")
      );
    }
    return base;
  }, [items, query, sort]);

  const goMovie = (m) => {
    const id = m?.id ?? m?.tmdb_id ?? m?.movie_id ?? null;
    if (!id) return;
    navigate(`${MOVIE_ROUTE}/${id}`);
  };

  const shufflePick = () => {
    if (!filtered.length) return;
    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    goMovie(pick);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 pb-10">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="h-9 w-9 grid place-items-center rounded-full border border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:text-white hover:border-zinc-600 transition"
            aria-label="Go back"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="text-2xl sm:text-3xl font-semibold text-white">
              Watchlist
            </div>
            <div className="text-xs text-zinc-400">
              {items.length} saved films
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={shufflePick}
          className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-wide text-zinc-200 hover:text-white transition"
          disabled={!filtered.length}
        >
          <Shuffle size={14} />
          Shuffle pick
        </button>
      </div>

      <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80">
        <div className="absolute -top-16 right-6 h-40 w-40 rounded-full bg-yellow-400/10 blur-3xl" />
        <div className="absolute -bottom-20 left-6 h-44 w-44 rounded-full bg-white/5 blur-3xl" />
        <div className="relative p-5 sm:p-7">
          <div className="text-[11px] uppercase tracking-[0.28em] text-zinc-400">
            Your watchlist
          </div>
          <div className="mt-2 text-xl sm:text-3xl font-semibold text-white">
            Keep the films you want to see within reach.
          </div>
          <div className="mt-2 text-sm sm:text-base text-zinc-400 max-w-2xl">
            This is your queue for future nights. Sort, filter, and choose the
            one that fits your mood without losing the highlights from your
            profile.
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-[11px] uppercase tracking-wide rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-200">
              {items.length} titles saved
            </span>
            <span className="text-[11px] uppercase tracking-wide rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-200">
              Pick one tonight
            </span>
          </div>
        </div>
      </section>

      <div className="mt-5 sm:mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-2 backdrop-blur">
          <Search size={16} className="text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your watchlist"
            className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-10 appearance-none rounded-full border border-white/10 bg-black/40 pl-4 pr-9 text-sm text-zinc-200 backdrop-blur focus:outline-none"
            >
              <option value="recent">Recently added</option>
              <option value="title">Title A–Z</option>
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
          </div>

          <button
            type="button"
            onClick={shufflePick}
            className="h-10 w-10 grid place-items-center rounded-full border border-white/10 bg-black/40 text-zinc-300 hover:text-white transition sm:hidden"
            title="Shuffle pick"
            disabled={!filtered.length}
          >
            <Shuffle size={14} />
          </button>

          <div className="flex rounded-full border border-white/10 bg-black/40 p-1">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`h-8 w-8 grid place-items-center rounded-full transition ${
                view === "grid"
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
              aria-pressed={view === "grid"}
              title="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`h-8 w-8 grid place-items-center rounded-full transition ${
                view === "list"
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
              aria-pressed={view === "list"}
              title="List view"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 text-sm text-zinc-400">
        {loading && items.length === 0
          ? "Loading your watchlist..."
          : `${filtered.length} results`}
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          Could not load watchlist. Try again in a moment.
        </div>
      ) : null}

      {!loading && !filtered.length ? (
        <div className="mt-8 rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/70 p-8 text-center text-zinc-400">
          {user ? (
            <>
              <div className="text-base text-white">Your watchlist is empty.</div>
              <div className="mt-2 text-sm text-zinc-500">
                Add films from any movie page to build your queue.
              </div>
            </>
          ) : (
            <>
              <div className="text-base text-white">Sign in to build your watchlist.</div>
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950/80 px-4 py-2 text-xs uppercase tracking-wide text-zinc-200 hover:text-white"
              >
                Go to sign in
              </button>
            </>
          )}
        </div>
      ) : null}

      {!loading && filtered.length ? (
        <div
          className={
            view === "grid"
              ? "mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-4"
              : "mt-6 space-y-3"
          }
        >
          {filtered.map((m) => {
            const poster = posterUrl(m);
            const id = m?.id ?? m?.tmdb_id ?? m?.movie_id ?? null;

            if (view === "list") {
              return (
                <div
                  key={id || m?.title}
                  className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3"
                >
                  <button
                    type="button"
                    onClick={() => goMovie(m)}
                    className="shrink-0 w-12 h-16 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900/40"
                    title={m?.title || ""}
                  >
                    {poster ? (
                      <TmdbImage
                        src={poster}
                        alt={m?.title || "Poster"}
                        className="w-full h-full"
                        imgClassName="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-[10px] text-zinc-500">
                        No image
                      </div>
                    )}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white truncate">
                      {m?.title || "Untitled"}
                    </div>
                    <div className="text-xs text-zinc-500">Saved to your watchlist</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(id)}
                    disabled={!id}
                    className={`h-9 w-9 grid place-items-center rounded-full border border-zinc-800 text-zinc-400 transition ${
                      id
                        ? "hover:text-white hover:border-zinc-600"
                        : "opacity-40 cursor-not-allowed"
                    }`}
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            }

            return (
              <div
                key={id || m?.title}
                className="group relative rounded-2xl border border-zinc-800 bg-zinc-950/70 p-2 hover:border-zinc-600 transition"
              >
                <button
                  type="button"
                  onClick={() => goMovie(m)}
                  className="w-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/40"
                  title={m?.title || ""}
                >
                  {poster ? (
                    <TmdbImage
                      src={poster}
                      alt={m?.title || "Poster"}
                      className="w-full h-[220px] sm:h-[240px]"
                      imgClassName="object-cover group-hover:scale-[1.03] transition"
                    />
                  ) : (
                    <div className="w-full h-[220px] sm:h-[240px] grid place-items-center text-xs text-zinc-500">
                      No image
                    </div>
                  )}
                </button>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">
                      {m?.title || "Untitled"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(id)}
                    disabled={!id}
                    className={`h-8 w-8 grid place-items-center rounded-full border border-zinc-800 text-zinc-400 transition ${
                      id
                        ? "hover:text-white hover:border-zinc-600"
                        : "opacity-40 cursor-not-allowed"
                    }`}
                    title="Remove"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
