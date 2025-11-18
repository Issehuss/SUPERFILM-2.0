// src/components/FilmTakeCard.jsx
import React from "react";
import { Star } from "lucide-react";

export default function FilmTakeCard({ take }) {
  if (!take) return null;

  const filmTitle =
    take.movie_title ||
    take.title ||
    "Untitled";

  const snippet =
    take.blurb ||
    take.review ||
    take.comment ||
    "You contributed to this review.";

  const rating =
    typeof take.rating === "number" ? take.rating : null;

  const createdAt = take.created_at || take.updated_at;
  const dateLabel = createdAt
    ? new Date(createdAt).toLocaleDateString("en-GB")
    : "";

  const poster =
    take.poster ||
    take.poster_url ||
    (take.poster_path
      ? (take.poster_path.startsWith("http")
          ? take.poster_path
          : `https://image.tmdb.org/t/p/w185${take.poster_path}`)
      : null);

  return (
    <article className="rounded-2xl border border-zinc-800 bg-black/40 hover:bg-black/60 hover:border-yellow-500/70 transition p-3 flex gap-3 shadow-[0_0_0_1px_rgba(0,0,0,0.5)]">
      {/* Poster */}
      <div className="w-12 h-16 flex-shrink-0">
        {poster ? (
          <img
            src={poster}
            alt={filmTitle}
            className="w-full h-full object-cover rounded-xl border border-zinc-800"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full rounded-xl bg-zinc-900 grid place-items-center text-[10px] text-zinc-600">
            No still
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col justify-between flex-1 min-w-0">
        <div>
          <p className="text-sm font-semibold text-white truncate">
            {filmTitle}
          </p>
          <p className="text-[11px] text-zinc-400 line-clamp-2">
            {snippet}
          </p>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
          {/* rating stars */}
          {rating != null && (
            <div className="flex items-center gap-1 text-yellow-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${
                    i < Math.round(rating)
                      ? "fill-yellow-400"
                      : "fill-transparent text-zinc-600"
                  }`}
                />
              ))}
              <span className="text-zinc-300 ml-1">
                {rating.toFixed(1).replace(/\.0$/, "")}/5
              </span>
            </div>
          )}
          <span>{dateLabel}</span>
        </div>
      </div>
    </article>
  );
}
