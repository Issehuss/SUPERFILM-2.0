// src/components/TakesPanel.jsx
import { useMemo } from "react";
import ReviewCards from "./ReviewCards";

/** loose UUID detector */
function looksLikeUuid(v) {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

/**
 * TakesPanel (compat wrapper)
 *
 * Props (backward-compatible):
 *  - open: boolean
 *  - onClose: () => void
 *  - clubId: UUID (required)
 *  - filmId: EITHER a film UUID or a TMDB numeric id (string/number)
 *  - filmUuid?: UUID (preferred if available)
 *  - movieId?: number | string (TMDB id)
 *
 * Any other props are ignored; ReviewCards owns the UI now.
 */
export default function TakesPanel({
  open,
  onClose,
  clubId,
  filmId,
  filmUuid,
  movieId,
}) {
  // Normalize to a single value ReviewCards can auto-detect
  const normalizedFilmId = useMemo(() => {
    if (filmUuid && looksLikeUuid(filmUuid)) return filmUuid;
    if (filmId && looksLikeUuid(filmId)) return filmId; // UUID path
    const numeric =
      movieId != null
        ? Number(movieId)
        : filmId != null
        ? Number(filmId)
        : null;
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }, [filmUuid, filmId, movieId]);

  return (
    <ReviewCards
    open={!!open}
    onClose={onClose}
    clubId={clubId}
    filmId={club.nextEvent.movieId}  // numeric TMDB id
    movieTitle={club.nextEvent.title}
    posterPath={club.nextEvent.poster}
  />
  

  );
}
