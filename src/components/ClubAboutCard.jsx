import { useState, useEffect, useRef } from "react";
import supabase from "../supabaseClient";
import { MapPin, Info, X, Plus } from "lucide-react";

export default function ClubAboutCard({ club, isEditing, canEdit, onSaved }) {
  const [about, setAbout] = useState(club?.about || "");
  const [location, setLocation] = useState(club?.location || "");
  const [genres, setGenres] = useState(club?.genres || []);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [genreInput, setGenreInput] = useState("");
  const [dirty, setDirty] = useState(false);
  const prevEditingRef = useRef(isEditing);

  useEffect(() => {
    setAbout(club?.about || "");
    setLocation(club?.location || "");
    setGenres(Array.isArray(club?.genres) ? club.genres : []);
    setDirty(false);
  }, [club]);

  async function save() {
    if (!canEdit || !club?.id) return;
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("clubs")
        .update({ about, location, genres })
        .eq("id", club.id);
      if (error) throw error;
      onSaved?.({ about, location, genres });
      setDirty(false);
    } catch (e) {
      alert(e.message || "Could not save About section.");
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
        Prime Location
      </label>
      <div className="relative mb-3">
        <MapPin className="w-4 h-4 text-yellow-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
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
        onChange={(e) => setAbout(e.target.value)}
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
            if (!genres.includes("Any and all genres"))
              setGenres([...genres, "Any and all genres"]);
          }}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:text-yellow-400"
        >
          Add “Any and all genres”
        </button>
      </div>
    </section>
  );
}
