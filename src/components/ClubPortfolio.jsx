// src/components/ClubPortfolio.jsx
import { Film } from "lucide-react";
import FeaturedFilmsCompact from "./FeaturedFilmsCompact";
import NominationsCarousel from "./NominationsCarousel";

export default function ClubPortfolio({
  club,
  canEdit,
  onEditFeatured,      // optional: open your existing feature picker
}) {
  const about = {
    tagline: club?.tagline || "",
    primeLocation: club?.primeLocation || club?.location || "—",
    genreFocus: Array.isArray(club?.genreFocus) ? club.genreFocus : [],
    schedule: club?.meetingSchedule || "",
    founded: club?.created_at ? new Date(club.created_at).getFullYear() : undefined,
    nextLine: club?.nextEvent?.title
      ? `Next: ${club.nextEvent.title} • ${new Date(club.nextEvent.date).toLocaleDateString()}`
      : null,
  };

  return (
    <section className="px-6 mt-8">
      <h2 className="text-lg font-bold text-yellow-400 mb-3 flex items-center gap-2">
        <Film className="w-5 h-5" /> Discover This Club
      </h2>

      <div className="grid gap-4 md:grid-cols-[1.2fr,1fr,1fr]">
        {/* About */}
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
          {about.tagline ? (
            <p className="text-xl font-semibold mb-2">{about.tagline}</p>
          ) : (
            <p className="text-xl font-semibold mb-2 opacity-70">A club for cinephiles.</p>
          )}

          <div className="flex flex-wrap gap-2 text-[12px]">
            {about.primeLocation && (
              <span className="px-2 py-1 rounded-full bg-zinc-800/70 text-zinc-200">
                📍 {about.primeLocation}
              </span>
            )}
            {!!about.genreFocus?.length &&
              about.genreFocus.slice(0, 3).map((g) => (
                <span key={g} className="px-2 py-1 rounded-full bg-zinc-800/70 text-zinc-200">
                  🎞 {g}
                </span>
              ))}
            {about.schedule && (
              <span className="px-2 py-1 rounded-full bg-zinc-800/70 text-zinc-200">
                🗓 {about.schedule}
              </span>
            )}
          </div>

          <p className="text-sm text-zinc-300 mt-3">
            {club?.about?.trim()
              ? club.about.trim()
              : "We screen films that linger, spark lively discussion, and broaden taste."}
          </p>

          <div className="text-xs text-zinc-500 mt-3">
            {about.founded ? `Founded ${about.founded} • ` : null}
            Volunteer-run
          </div>

          {about.nextLine && (
            <div className="mt-3 text-sm text-zinc-300 border-t border-white/10 pt-3">
              {about.nextLine}
            </div>
          )}
        </div>

        {/* Featured Films (compact strip) */}
        <FeaturedFilmsCompact
          posters={club?.featuredFilms || []}
          metaMap={club?.featuredMap || {}}
          canEdit={!!canEdit}
          onEdit={onEditFeatured}
        />

        {/* Nominations (carousel) */}
        <NominationsCarousel clubId={club?.id} />
      </div>
    </section>
  );
}
