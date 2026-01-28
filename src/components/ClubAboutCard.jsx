import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import supabase from "lib/supabaseClient";
import { MapPin, Info, X, Plus } from "lucide-react";

const DISCOVER_CACHE_KEY = "sf.clubs2.cache.v2";
const CLUB_ABOUT_UPDATED_EVENT = "sf:club:about-updated";

const applyMetaPatch = (clubId, metaPatch) => {
  if (typeof window === "undefined" || !clubId) return;
  try {
    const raw = localStorage.getItem(DISCOVER_CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed?.data?.clubs?.length) return;
    const normalizedId = String(clubId);
    let changed = false;
    const nextClubs = (parsed.data.clubs || []).map((entry) => {
      const matches =
        String(entry.rawId) === normalizedId ||
        String(entry.id) === `db-${normalizedId}`;
      if (!matches) return entry;
      changed = true;
      return {
        ...entry,
        meta: {
          ...(entry.meta || {}),
          ...metaPatch,
        },
      };
    });
    if (!changed) return;
    localStorage.setItem(
      DISCOVER_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), data: { ...parsed.data, clubs: nextClubs } })
    );
  } catch {}
};

const emitClubAboutUpdated = (clubId, metaPatch) => {
  if (typeof window === "undefined" || !clubId) return;
  window.dispatchEvent(
    new CustomEvent(CLUB_ABOUT_UPDATED_EVENT, {
      detail: { clubId, metaPatch },
    })
  );
};

const sanitizeMetaPatch = (patch) => {
  const entries = Object.entries(patch || {}).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries);
};

export default function ClubAboutCard({ club, isEditing, canEdit, onSaved }) {
  const [about, setAbout] = useState(club?.about || "");
  const [tagline, setTagline] = useState(club?.tagline || "");
  const [location, setLocation] = useState(club?.location || "");
  const [genres, setGenres] = useState(
    Array.isArray(club?.genres) && club.genres.length
      ? club.genres
      : Array.isArray(club?.meta?.genres)
      ? club.meta.genres
      : []
  );
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [genreInput, setGenreInput] = useState("");
  const [dirty, setDirty] = useState(false);
  const prevEditingRef = useRef(isEditing);

  useEffect(() => {
    if (isEditing && dirty) return;
    setAbout(club?.about || "");
    setTagline(club?.tagline || "");
    setLocation(club?.location || "");
    if (Array.isArray(club?.genres) && club.genres.length) {
      setGenres(club.genres);
    } else if (Array.isArray(club?.meta?.genres)) {
      setGenres(club.meta.genres);
    } else {
      setGenres([]);
    }
    setDirty(false);
  }, [club, isEditing, dirty]);

  useEffect(() => {
    if (!isEditing || !club?.id) return;
    try {
      const raw = localStorage.getItem(`sf.club.aboutDraft:${club.id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed?.data) return;
      const d = parsed.data;
      setAbout(typeof d.about === "string" ? d.about : about);
      setTagline(typeof d.tagline === "string" ? d.tagline : tagline);
      setLocation(typeof d.location === "string" ? d.location : location);
      setGenres(Array.isArray(d.genres) ? d.genres : genres);
      setDirty(true);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club?.id, isEditing]);

  useEffect(() => {
    if (!isEditing || !club?.id) return;
    try {
      const payload = {
        about,
        tagline,
        location,
        genres,
      };
      localStorage.setItem(
        `sf.club.aboutDraft:${club.id}`,
        JSON.stringify({ at: Date.now(), data: payload })
      );
    } catch {}
  }, [about, tagline, location, genres, isEditing, club?.id]);

  async function save() {
    if (!canEdit || !club?.id) return;
    if (busy) return;
    setBusy(true);

    const payload = { about, tagline, location, genres };
    const trimmedTagline = tagline?.trim() || "";
    const trimmedAbout = about?.trim() || "";
    const summarySource = trimmedTagline || trimmedAbout;
    const summary =
      summarySource.length > 140 ? `${summarySource.slice(0, 140).trim()}…` : summarySource;

    const metaPatch = sanitizeMetaPatch({
      summary: summary || undefined,
      tagline,
      location,
      genres,
    });
    const nextMeta = sanitizeMetaPatch({
      ...(club?.meta || {}),
      ...metaPatch,
    });
    const patch = {
      ...payload,
      summary,
      meta: nextMeta,
    };

    const toastId = toast.loading("Saving about info…");
    onSaved?.(patch);
    applyMetaPatch(club.id, metaPatch);
    emitClubAboutUpdated(club.id, metaPatch);

    try {
      const { error } = await supabase.from("clubs").update(payload).eq("id", club.id);
      if (error) throw error;
      toast.success("About updated.", { id: toastId });
      setDirty(false);
      try {
        localStorage.removeItem(`sf.club.aboutDraft:${club.id}`);
      } catch {}
    } catch (e) {
      toast.error(e.message || "Could not save About section.", { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  // Auto-save when finishing editing (on transition from editing → view)
  useEffect(() => {
    const wasEditing = prevEditingRef.current;
    if (wasEditing && !isEditing && dirty) {
      save();
    }
    prevEditingRef.current = isEditing;
  }, [isEditing, dirty]);

  function addGenre() {
    const val = genreInput.trim();
    if (!val) return;
    if (!genres.includes(val)) {
      setGenres([...genres, val]);
      setDirty(true);
    }
    setGenreInput("");
  }

  function removeGenre(g) {
    setGenres(genres.filter((x) => x !== g));
    setDirty(true);
  }

  // ---------- VIEW MODE ----------
  if (!isEditing) {
    const isLong = about && about.length > 400;
    const shortText = about ? about.slice(0, 400) + (isLong ? "..." : "") : "";

    return (
      <section className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
        <h2 className="text-lg font-bold text-yellow-400 mb-2 flex items-center gap-2">
          <Info className="w-5 h-5" /> About the Club
        </h2>

        {/* Location chip */}
        {location && (
          <div className="inline-flex items-center gap-2 bg-zinc-900/60 rounded-full px-3 py-1 text-sm mb-3">
            <MapPin className="w-4 h-4 text-yellow-400" />
            <span className="text-zinc-200">{location}</span>
          </div>
        )}

        {/* Genres chips */}
        {genres?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {genres.map((g) => (
              <span
                key={g}
                className="bg-zinc-800 text-zinc-200 text-xs px-3 py-1 rounded-full"
              >
                {g}
              </span>
            ))}
          </div>
        )}

        {/* About text with read-more */}
        {tagline && (
          <p className="text-sm font-semibold text-zinc-200 mb-2">{tagline}</p>
        )}
        <div className="relative">
          <p
            className={`text-sm leading-6 text-zinc-300 whitespace-pre-wrap transition-all duration-300 ease-in-out ${
              expanded ? "max-h-[999px]" : "max-h-[200px] overflow-hidden"
            }`}
          >
            {expanded ? about : shortText || "No description yet."}
          </p>
          {isLong && !expanded && (
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
          )}
        </div>

        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-2 text-xs text-yellow-400 hover:underline"
          >
            {expanded ? "Read less" : "Read more"}
          </button>
        )}
      </section>
    );
  }

  // ---------- EDIT MODE ----------
  return (
    <section className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
      <h2 className="text-lg font-bold text-yellow-400 mb-3 flex items-center gap-2">
        <Info className="w-5 h-5" /> About the Club
      </h2>

      {/* Location */}
      <label className="block text-xs uppercase tracking-wide text-zinc-400 mb-1">
        Tagline
      </label>
      <input
        value={tagline}
        onChange={(e) => {
          setTagline(e.target.value);
          setDirty(true);
        }}
        className="w-full bg-zinc-900/70 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none mb-3"
        placeholder="Short, punchy line that sums up the club"
      />

      {/* Location */}
      <label className="block text-xs uppercase tracking-wide text-zinc-400 mb-1">
        Prime Location
      </label>
      <div className="relative mb-3">
        <MapPin className="w-4 h-4 text-yellow-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={location}
          onChange={(e) => {
            setLocation(e.target.value);
            setDirty(true);
          }}
          className="w-full bg-zinc-900/70 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white outline-none"
          placeholder="e.g., Electric Cinema, Notting Hill"
        />
      </div>

      {/* About */}
      <label className="block text-xs uppercase tracking-wide text-zinc-400 mb-1">
        About
      </label>
      <textarea
        value={about}
        onChange={(e) => {
          setAbout(e.target.value);
          setDirty(true);
        }}
        rows={6}
        className="w-full bg-zinc-900/70 border border-zinc-800 rounded-lg p-3 text-sm text-white outline-none mb-3"
        placeholder="Write about your club — focus, vibe, or what new members can expect."
      />

      {/* Genres */}
      <label className="block text-xs uppercase tracking-wide text-zinc-400 mb-1">
        Genres
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {genres.map((g) => (
          <div
            key={g}
            className="flex items-center gap-1 bg-zinc-800 text-zinc-200 text-xs px-3 py-1 rounded-full"
          >
            <span>{g}</span>
            <button
              type="button"
              onClick={() => removeGenre(g)}
              className="hover:text-yellow-400"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
      <input
        value={genreInput}
        onChange={(e) => setGenreInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGenre())}
          className="flex-1 bg-zinc-900/70 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white outline-none"
          placeholder="Type a genre and press Enter"
        />
        <button
          type="button"
          onClick={addGenre}
          className="rounded-lg bg-yellow-500 px-3 py-2 text-sm font-semibold text-black hover:bg-yellow-400"
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          onClick={() => {
        if (!genres.includes("Any and all genres")) {
          setGenres([...genres, "Any and all genres"]);
          setDirty(true);
        }
      }}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:text-yellow-400"
        >
          Add “Any and all genres”
        </button>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={busy || !dirty}
            className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save about"}
          </button>
        </div>
      )}
    </section>
  );
}
