import { useEffect, useMemo, useRef, useState } from "react";
import supabase from "../supabaseClient";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import TmdbImage from "./TmdbImage";
import { toast } from "react-hot-toast";

const TMDB_BASE = "https://image.tmdb.org/t/p/w500";
const AUTO_MS = 6000;

export default function NominationsCarousel({
  clubId,
  canEdit = false,
  isEditing = false,
  onRemove,
}) {
  const [rows, setRows] = useState([]);
  const [idx, setIdx] = useState(0);
  const [isHover, setHover] = useState(false);
  const [confirmingId, setConfirmingId] = useState(null);
  const ref = useRef(null);
  const pageCount = useMemo(
    () => (rows.length ? Math.ceil(rows.length / 4) : 0),
    [rows.length]
  );

  // --- Fetch nominations directly ---
  useEffect(() => {
    if (!clubId) return;
    let active = true;

    (async () => {
      const { data, error } = await supabase
        .from("nominations")
        .select("*")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false });

      if (!active) return;
      if (error) console.error(error);

      const mapped = (data || []).map((r) => ({
        id: r.id,
        movie_id: r.movie_id,
        title: r.movie_title || "Untitled",
        poster: r.poster_path
          ? `${TMDB_BASE}${r.poster_path}`
          : "/poster_fallback.jpg",
        votes: r.votes ?? 0,
      }));
      setRows(mapped);
    })();

    return () => {
      active = false;
    };
  }, [clubId]);

  // --- Auto scroll ---
  useEffect(() => {
    if (pageCount <= 1 || isHover) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % pageCount);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [pageCount, isHover]);

  // --- Page grouping ---
  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < rows.length; i += 4) out.push(rows.slice(i, i + 4));
    return out;
  }, [rows]);

  async function removeNomination(id) {
    const { error } = await supabase.from("nominations").delete().eq("id", id);
    if (error) {
      console.error(error);
      return alert("Error removing nomination.");
    }
    setRows((r) => r.filter((x) => x.id !== id));
    setConfirmingId(null);
    if (typeof onRemove === "function") {
      onRemove(id);
    }
    toast.success("Nomination removed");
  }
  

  function go(delta) {
    if (pageCount === 0) return;
    setIdx((i) => (i + delta + pageCount) % pageCount);
  }

  // --- Empty state ---
  if (!rows.length) {
    return (
      <section className="mt-10 w-full bg-black/40 border-t border-zinc-800 py-10 text-center text-zinc-400">
        <h2 className="text-lg font-bold text-yellow-400 mb-2">
          Current Nominations
        </h2>
        <p className="text-sm text-zinc-400">
          No films have been nominated yet — stay tuned.
        </p>
      </section>
    );
  }

  return (
    <section
      className="relative w-full mt-10 py-10 bg-black/40 border-t border-zinc-800"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      ref={ref}
    >
      <div className="px-6 flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-yellow-400">
          Current Nominations
        </h2>
        <div className="flex gap-1">
          <IconButton onClick={() => go(-1)}>
            <ChevronLeft size={18} />
          </IconButton>
          <IconButton onClick={() => go(1)}>
            <ChevronRight size={18} />
          </IconButton>
        </div>
      </div>

      <div className="overflow-hidden px-6">
        {pages.map((page, i) => (
          <div
            key={i}
            className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 transition-transform duration-700 ease-in-out`}
            style={{
              transform: `translateX(${(i - idx) * 100}%)`,
              display: i === idx ? "grid" : "none",
            }}
          >
            {page.map((r) => (
              <div
                key={r.id}
                className="relative group rounded-2xl overflow-hidden bg-zinc-900/60 ring-1 ring-white/10 hover:ring-yellow-400/70 transition"
              >
                <TmdbImage
                  src={r.poster}
                  alt={r.title}
                  className="block w-full h-full"
                  imgClassName="group-hover:scale-[1.03] transition"
                />

                {/* Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 flex items-center justify-between">
                  <span className="text-[13px] text-white truncate max-w-[80%]">
                    {r.title}
                  </span>
                  {r.votes > 0 && (
                    <span className="text-xs font-semibold text-yellow-400">
                      +{r.votes}
                    </span>
                  )}
                </div>

                {canEdit && isEditing && (
                  <div className="absolute top-2 right-2 flex items-center gap-2">
                    {confirmingId === r.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => removeNomination(r.id)}
                          className="rounded-full bg-yellow-500 text-black text-[10px] px-2 py-1 shadow"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          className="rounded-full bg-black/60 text-white text-[10px] px-2 py-1"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingId(r.id)}
                        className="rounded-full bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition"
                        title="Remove nomination"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                )}

              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function IconButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded bg-zinc-800 hover:bg-zinc-700 p-1 text-zinc-200"
    >
      {children}
    </button>
  );
}
