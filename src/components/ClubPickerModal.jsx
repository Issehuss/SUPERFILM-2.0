import React from "react";
import PropTypes from "prop-types";

export default function ClubPickerModal({
  open,
  clubs,
  movieTitle,
  loading,
  onClose,
  onSelect,
}) {
  if (!open) return null;

  const normalizedTitle = movieTitle || "this film";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      aria-live="polite"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Choose a club for nominating ${normalizedTitle}`}
        className="relative w-full max-w-md rounded-3xl border border-yellow-400/50 bg-gradient-to-br from-zinc-950/95 to-zinc-900/60 p-5 shadow-[0_20px_80px_rgba(0,0,0,0.8)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-yellow-300">
              SuperFilm nominator
            </p>
            <h3 className="mt-1 text-2xl font-bold text-white">
              Choose a club
            </h3>
            <p className="text-sm text-zinc-400">
              Which club should {normalizedTitle} count for?
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400"
            aria-label="Close club selector"
          >
            Done
          </button>
        </div>

        <div className="mt-6 flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
          {loading && !clubs?.length ? (
            <div className="text-center text-sm text-zinc-400">
              Loading your clubs…
            </div>
          ) : clubs?.length ? (
            clubs.map((club) => (
              <button
                key={club.id}
                onClick={() => onSelect(club)}
                className="group flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 text-left text-white transition hover:border-yellow-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-yellow-400 focus-visible:outline-offset-2"
              >
                {club.profile_image_url ? (
                  <img
                    src={club.profile_image_url}
                    alt={club.name}
                    className="h-12 w-12 rounded-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 text-xs uppercase text-zinc-300">
                    {club.name?.[0] || "S"}
                  </div>
                )}

                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{club.name}</p>
                  <p className="text-xs text-zinc-500">
                    #{club.slug || club.id}
                  </p>
                </div>

                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-yellow-400 transition group-hover:text-yellow-300">
                  Nominate
                </span>
              </button>
            ))
          ) : (
            <div className="text-center text-sm text-zinc-400">
              No clubs ready for nominations yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

ClubPickerModal.propTypes = {
  open: PropTypes.bool,
  clubs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name: PropTypes.string,
      slug: PropTypes.string,
      profile_image_url: PropTypes.string,
    })
  ),
  movieTitle: PropTypes.string,
  loading: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onSelect: PropTypes.func.isRequired,
};

ClubPickerModal.defaultProps = {
  open: false,
  clubs: [],
  movieTitle: "",
  loading: false,
};
