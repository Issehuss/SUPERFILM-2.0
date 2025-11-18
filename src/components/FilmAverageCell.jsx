// src/components/FilmAverageCell.jsx
import { useState, useMemo } from "react";
import ReviewCards from "./ReviewCards";

/**
 * FilmAverageCell
 * Displays the club’s average rating (passed from parent),
 * and opens the ReviewCards modal when clicked.
 *
 * Props:
 * - average: number | null
 * - clubId: uuid
 * - filmId: string | number (TMDB id)
 * - movieTitle: string
 * - posterPath: string
 */
export default function FilmAverageCell({
  average,
  clubId,
  filmId,
  movieTitle,
  posterPath,
}) {
  const [open, setOpen] = useState(false);

  // Format average nicely
  const avgText = useMemo(() => {
    if (average == null) return "—";
    const n = Number(average);
    return Number.isFinite(n) ? n.toFixed(1) : "—";
  }, [average]);

  return (
    <>
      {/* Average label */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="underline decoration-zinc-600 underline-offset-4 text-white hover:decoration-zinc-300"
        title="Open reviews"
      >
        {avgText}
      </button>

      {/* Modal */}
      <ReviewCards
        open={open}
        onClose={() => setOpen(false)}
        clubId={clubId}
        filmId={filmId}
        movieTitle={movieTitle}
        posterPath={posterPath}
      />
    </>
  );
}
