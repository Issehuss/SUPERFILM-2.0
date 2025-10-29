import { useEffect, useMemo, useRef, useState } from "react";
import supabase from "../supabaseClient";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const TMDB_BASE = "https://image.tmdb.org/t/p/w500";
const AUTO_MS = 6000;

export default function NominationsCarousel({ clubId, canEdit = false }) {
  const [rows, setRows] = useState([]);
  const [idx, setIdx] = useState(0);
  const [isHover, setHover] = useState(false);
  const ref = useRef(null);

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
    if (rows.length <= 4 || isHover) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % Math.ceil(rows.length / 4));
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [rows.length, isHover]);

  // --- Page grouping ---
  const pages = useMemo(() => {
    const out = [];
    for (let i = 0; i < rows.length; i += 4) out.push(rows.slice(i, i + 4));
    return out;
  }, [rows]);

  async function removeNomination(id) {
    const confirmed = window?.confirm
      ? window.confirm("Remove this nomination?")
      : true;
  
    if (!confirmed) return;
  
    const { error } = await supabase.from("nominations").delete().eq("id", id);
    if (error) {
      console.error(error);
      return alert("Error removing nomination.");
    }
    setRows((r) => r.filter((x) => x.id !== id));
  }
  

  function go(delta) {
    if (pages.length === 0) return;
    setIdx((i) => (i + delta + pages.length) % pages.length);
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
                <img
                  src={r.poster}
                  alt={r.title}
                  className="block w-full h-full object-cover group-hover:scale-[1.03] transition"
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

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => removeNomination(r.id)}
                    className="absolute top-2 right-2 rounded-full bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition"
                  >
                    <X size={16} />
                  </button>
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
