import { useEffect, useState } from "react";
import supabase from "lib/supabaseClient";
import { searchMovies } from "../lib/tmdbClient";
import { Plus, Save, X } from "lucide-react";
import { toast } from "react-hot-toast";

/**
 * Props:
 *  - club: { id, featuredFilms?: string[] }
 *  - canEdit: boolean          // presidents/admins
 *  - showSearch: boolean       // true only in edit mode
 *  - onChange?: (next) => void // optional callback
 */

export default function FeaturedFilms({ club, canEdit, showSearch, onChange }) {
  const [films, setFilms] = useState(() => club?.featuredFilms || []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setFilms(Array.isArray(club?.featuredFilms) ? club.featuredFilms : []);
    setDirty(false);
  }, [club?.featuredFilms]);

  useEffect(() => {
    if (!club?.id || !showSearch) return;
    try {
      const raw = localStorage.getItem(`sf.club.featuredDraft:${club.id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.data)) return;
      setFilms(parsed.data);
      setDirty(true);
    } catch {}
  }, [club?.id, showSearch]);

  useEffect(() => {
    if (!club?.id || !showSearch) return;
    if (!dirty) return;
    try {
      localStorage.setItem(
        `sf.club.featuredDraft:${club.id}`,
        JSON.stringify({ at: Date.now(), data: films })
      );
    } catch {}
  }, [films, dirty, showSearch, club?.id]);

  async function persist(next) {
    if (!club?.id) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("clubs")
        .update({ featured_posters: next })
        .eq("id", club.id);
      if (error) throw error;
      setFilms(next);
      onChange?.(next);
      toast.success("Featured films saved.");
      setDirty(false);
      try {
        localStorage.removeItem(`sf.club.featuredDraft:${club.id}`);
      } catch {}
    } catch (e) {
      console.error(e);
      toast.error("Could not save featured films.");
    } finally {
      setBusy(false);
    }
  }

  async function doSearch() {
    const q = (query || "").trim();
    if (!q) return setResults([]);
    setSearching(true);
    try {
      const hits = await searchMovies(q);
      const mapped = (hits || [])
        .map(h => ({
          id: h.id,
          title: h.title,
          poster: h.posterUrl || h.backdropUrl || null,
        }))
        .filter(x => !!x.poster);
      setResults(mapped);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function addPoster(url) {
    if (!url) return;
    const next = films.includes(url) ? films : [...films, url];
    setFilms(next);
    setDirty(true);
    setResults([]);
    setQuery("");
  }

  async function removePoster(url) {
    const next = films.filter(p => p !== url);
    setFilms(next);
    setDirty(true);
  }

  const hasFilms = films.length > 0;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-yellow-400">Featured Films</h2>

        {canEdit && showSearch && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => persist(films)}
              disabled={busy || !dirty}
              className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
            >
              {busy ? "Saving…" : <><Save size={16} /> Save</>}
            </button>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder="Search films…"
              className="bg-zinc-900/70 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-white outline-none"
            />
            <button
              onClick={doSearch}
              disabled={searching}
              className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
              type="button"
            >
              {searching ? "Searching…" : <><Plus size={16}/> Add</>}
            </button>
          </div>
        )}
      </div>

      {/* === EMPTY STATE === */}
      {!hasFilms && !showSearch && (
        <div className="rounded-xl border border-zinc-800 bg-black/30 p-6 text-center text-sm text-zinc-300">
          Your club's mixtape is for everyone to see so add your essential picks!
        </div>
      )}

      {/* === EDIT MODE PLACEHOLDER === */}
      {!hasFilms && showSearch && (
        <div className="flex flex-col items-center justify-center text-center py-12 px-4 border border-dashed border-zinc-700 rounded-2xl bg-gradient-to-b from-black/50 to-black/30">
          <p className="text-base font-medium text-yellow-400 mb-1">
            Show your taste — curate your club’s signature films here.
          </p>
          <p className="text-sm text-zinc-400 mb-6">
            Your club's mixtape is for everyone to see so add your essential picks!
          </p>

          <p className="text-xs text-zinc-400 max-w-xs">
            Use the search bar above to find films and add them to the lineup.
          </p>
        </div>
      )}

      {/* === GRID === */}
      {hasFilms && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {films.map((src, i) => (
            <div key={`${src}-${i}`} className="relative group rounded-xl overflow-hidden ring-1 ring-white/10">
              <img
                src={src}
                alt="Featured film"
                className="block w-full h-full object-cover"
                loading="lazy"
              />
              {canEdit && showSearch && (
                <button
                  onClick={() => removePoster(src)}
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition"
                  aria-label="Remove featured film"
                  type="button"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* === SEARCH RESULTS === */}
      {canEdit && showSearch && results.length > 0 && (
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-zinc-400 mb-2">
            Pick to feature
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-3">
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => addPoster(r.poster)}
                className="relative rounded-lg overflow-hidden ring-1 ring-white/10 hover:ring-yellow-400/70 transition"
                type="button"
                title={r.title}
              >
                <img src={r.poster} alt={r.title} className="block w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-[11px] text-left">
                  {r.title}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
