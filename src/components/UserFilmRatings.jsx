// src/components/UserFilmRatings.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabaseClient";

// Small in-memory cache so we don't spam TMDB
const posterCache = new Map();

// Fetch poster_path/profile_path via Supabase Edge Function (secure)
async function fetchPosterPath(filmId) {
  if (!filmId) return "";
  if (posterCache.has(filmId)) return posterCache.get(filmId);

  // Accept "movie:123" / "tv:456" / "123" (assume movie if no prefix)
  let [kind, id] = String(filmId).includes(":")
    ? String(filmId).split(":")
    : ["movie", String(filmId)];

  try {
    const { data, error } = await supabase.functions.invoke("tmdb-proxy", {
      body: { path: `/${kind}/${id}`, query: { language: "en-GB" } },
    });
    if (error) throw error;

    const path = data?.poster_path || data?.profile_path || "";
    posterCache.set(filmId, path || "");
    return path || "";
  } catch (e) {
    console.warn("TMDB detail fetch failed:", e?.message || e);
    posterCache.set(filmId, "");
    return "";
  }
}

function tmdbImg(path, size = "w500") {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export default function UserFilmRatings({
  userId,
  limit = 24,
  className = "",
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch latest ratings for this user (with club & screening context)
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);

      // If you created the view:
      const { data, error } = await supabase
        .from("user_screening_ratings")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);

      // If you didn't create the view, use this instead (comment the block above and uncomment below):
      /*
      const { data, error } = await supabase
        .from("screening_ratings")
        .select(`
          stars, created_at, screening_id, film_id,
          screenings!inner ( starts_at, title, club_id, clubs!inner ( name, slug ) )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      */

      if (cancelled) return;
      if (error) {
        console.error("Ratings fetch error", error);
        setItems([]);
        setLoading(false);
        return;
      }

      // Normalize to a consistent shape whether using the view or the join
      const rows = (data || []).map((r) => ({
        stars: r.stars,
        created_at: r.created_at,
        screening_id: r.screening_id,
        film_id: r.film_id,
        starts_at: r.starts_at,
        screening_title: r.screening_title,
        club_id: r.club_id,
        club_name: r.club_name || r.clubs?.name,
        club_slug: r.club_slug || r.clubs?.slug,
      }));

      // Fetch posters (best-effort, via secure proxy)
      const enriched = await Promise.all(
        rows.map(async (row) => {
          const posterPath = await fetchPosterPath(row.film_id);
          return { ...row, posterPath };
        })
      );

      if (!cancelled) {
        setItems(enriched);
        setLoading(false);
      }
    }

    if (userId) run();
    return () => {
      cancelled = true;
    };
  }, [userId, limit]);

  if (loading) {
    return (
      <div
        className={`w-full rounded-2xl border border-zinc-800 bg-black/40 p-4 ${className}`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Film Ratings</h3>
          <div className="text-sm text-zinc-400">Loading…</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-44 rounded-lg bg-zinc-900 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div
        className={`w-full rounded-2xl border border-zinc-800 bg-black/40 p-4 ${className}`}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Film Ratings</h3>
        </div>
        <p className="text-sm text-zinc-400">No ratings yet.</p>
      </div>
    );
  }

  return (
    <div
      className={`w-full rounded-2xl border border-zinc-800 bg-black/40 p-4 ${className}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Film Ratings</h3>
        <div className="text-sm text-zinc-400">{items.length} rated</div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {items.map((it) => {
          const src = tmdbImg(it.posterPath, "w342");
          const clubSlugOrId = it.club_slug || it.club_id;

          return (
            <button
              key={`${it.screening_id}-${it.film_id}`}
              type="button"
              onClick={() =>
                navigate(`/clubs/${clubSlugOrId}/screenings/${it.screening_id}`, {
                  state: { clubName: it.club_name },
                })
              }
              className="group text-left"
              title={`${it.screening_title || "Screening"} — ${new Date(
                it.starts_at
              ).toLocaleDateString()}`}
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
                {src ? (
                  <img
                    src={src}
                    alt="Poster"
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-zinc-600 text-xs">
                    No poster
                  </div>
                )}

                {/* Stars pill (top-left) */}
                <div className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-medium text-yellow-400">
                  {"★".repeat(it.stars)}{" "}
                  <span className="text-zinc-300">{it.stars}/5</span>
                </div>

                {/* Club pill (bottom-left) */}
                <div className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] text-zinc-300">
                  {it.club_name || "Club"}
                </div>
              </div>

              <div className="mt-2 text-[13px] leading-tight text-zinc-200 line-clamp-2">
                {it.screening_title || "Screening"}
              </div>
              <div className="text-[12px] text-zinc-400">
                {new Date(it.starts_at).toLocaleDateString([], {
                  dateStyle: "medium",
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
