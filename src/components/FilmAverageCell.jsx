// src/components/FilmAverageCell.jsx
import { useState, useMemo } from "react";
import ReviewCards from "./ReviewCards"; // ⬅️ switch from TakesPanel to ReviewCards

export default function FilmAverageCell({ clubId, filmId, average }) {
  const [open, setOpen] = useState(false);

  // pretty number or em dash
  const avgText = useMemo(() => {
    if (average == null) return "—";
    const n = Number(average);
    return Number.isFinite(n) ? n.toFixed(1) : "—";
  }, [average]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="underline decoration-zinc-600 underline-offset-4 text-white hover:decoration-zinc-300"
        title="Open takes & ratings"
      >
        {avgText}
      </button>

      <ReviewCards
        open={open}
        onClose={() => setOpen(false)}
        clubId={clubId}   // UUID
        filmId={filmId}   // UUID *or* TMDB number; ReviewCards auto-detects
      />
    </>
  );
}
