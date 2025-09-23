// src/components/NominationsPanel.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import supabase from "../supabaseClient.js";
import { Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";


const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Props:
 * - clubId?: string
 * - limit?: number = 12
 * - posterHoverClass?: string
 * - onPosterClick?: (movie: { id, title, poster_path }) => void
 * - movieRoute?: string = "/movies"
 * - canRemove?: boolean = false
 */
export default function NominationsPanel({
  clubId: propClubId,
  limit = 12,
  posterHoverClass = "transition transform hover:scale-[1.03] hover:ring-2 hover:ring-yellow-500/80 hover:shadow-xl",
  onPosterClick,
  movieRoute = "/movies",
  canRemove = false,
}) {
  const { clubParam, id: legacyId } = useParams();
  const navigate = useNavigate();
  const routeParam = (clubParam || legacyId || "").trim();

  const [resolvedClubId, setResolvedClubId] = useState(propClubId || null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function resolveClubId() {
      setError("");
      if (propClubId) {
        setResolvedClubId(propClubId);
        return;
      }
      if (!routeParam) {
        setResolvedClubId(null);
        return;
      }
      if (UUID_RX.test(routeParam)) {
        setResolvedClubId(routeParam);
        return;
      }
      try {
        setResolving(true);
        const { data, error } = await supabase
          .from("clubs")
          .select("id")
          .eq("slug", routeParam)
          .maybeSingle();

        if (cancelled) return;

        if (error) setError(error.message || "Could not resolve club.");
        setResolvedClubId(data?.id || null);
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || "Unknown error resolving club.");
          setResolvedClubId(null);
        }
      } finally {
        if (!cancelled) setResolving(false);
      }
    }

    resolveClubId();
    return () => {
      cancelled = true;
    };
  }, [propClubId, routeParam]);

  async function load(resolvedId) {
    setLoading(true);
    setError("");
    try {
      if (!resolvedId) {
        setItems([]);
        return;
      }
      const { data, error } = await supabase
        .from("nominations_by_film")
        .select("movie_id, movie_title, poster_path, upvotes, last_nomination_at")
        .eq("club_id", resolvedId)
        .order("upvotes", { ascending: false })
        .order("last_nomination_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      setItems(data || []);
    } catch (e) {
      setError(e?.message || "Failed to load nominations.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!resolvedClubId) return;
    load(resolvedClubId);
  }, [resolvedClubId, limit]);

  useEffect(() => {
    if (!resolvedClubId) return;
    const channel = supabase
      .channel(`nominations:${resolvedClubId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nominations", filter: `club_id=eq.${resolvedClubId}` },
        () => load(resolvedClubId)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolvedClubId]);

  function handlePosterClick(movie) {
    if (!movie?.id) return;
    if (typeof onPosterClick === "function") {
      onPosterClick(movie);   // uses the parent navigate from ClubProfile
    } else {
      navigate(`/movies/${movie.id}`); // fallback
    }
  }
  

  // Remove all nominations for a movie in this club (admin action)
  async function handleRemove(movieId) {
    if (!resolvedClubId || !movieId) return;
    // optimistic update
    setItems((prev) => prev.filter((x) => x.movie_id !== movieId));
    const { error } = await supabase
      .from("nominations")
      .delete()
      .eq("club_id", resolvedClubId)
      .eq("movie_id", movieId);
    if (error) {
      // revert if failed
      await load(resolvedClubId);
      alert(error.message || "Could not remove nomination.");
    }
  }

  if (resolving) {
    return (
      <section className="mt-8">
        <h2 className="text-lg font-bold text-yellow-400">Nominations</h2>
        <p className="text-sm text-zinc-400 mt-2">Resolving club…</p>
      </section>
    );
  }
  if (!resolvedClubId) return null;

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between pr-1">
        <h2 className="text-lg font-bold text-yellow-400">Nominations</h2>
        {items?.length > 0 && (
          <span className="text-xs text-zinc-400">{items.length} nominated</span>
        )}
      </div>

      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-white/5 ring-1 ring-white/10 animate-pulse" />
          ))}
        </div>
      ) : items?.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-3">
          {items.map((n) => {
            const movie = { id: n.movie_id, title: n.movie_title, poster_path: n.poster_path };
            return (
              <div
                key={n.movie_id}
                className={`group relative overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 ${posterHoverClass}`}
                title={n.movie_title}
              >
                {/* Poster in fixed 2:3 box */}
                <button
                  type="button"
                  onClick={() => handlePosterClick(movie)}
                  className="block w-full text-left"
                >
                  <div className="aspect-[2/3] w-full overflow-hidden">
                    <img
                      src={n.poster_path ? `https://image.tmdb.org/t/p/w500${n.poster_path}` : "/fallback-next.jpg"}
                      alt={n.movie_title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {/* Top-right upvotes chip */}
                  {"upvotes" in n && (
                    <div className="pointer-events-none absolute top-2 right-2 rounded-full bg-black/70 text-xs text-white px-2 py-1 ring-1 ring-white/10">
                      ▲ {n.upvotes ?? 0}
                    </div>
                  )}

                  {/* Bottom gradient title band */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
                    <div className="rounded-xl bg-gradient-to-t from-black/80 to-black/0 p-3">
                      <p className="text-sm font-medium text-white line-clamp-2">
                        {n.movie_title}
                      </p>
                      {n.last_nomination_at && (
                        <p className="text-[11px] text-zinc-300/80 mt-0.5">
                          Last nominated {new Date(n.last_nomination_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </button>

                {/* Admin remove */}
                {canRemove && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(n.movie_id);
                    }}
                    className="absolute top-2 left-2 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 ring-1 ring-white/10 opacity-0 group-hover:opacity-100 transition"
                    title="Remove nomination"
                    aria-label="Remove nomination"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-zinc-400 mt-2">
          No nominations yet. Nominate a film from its details page.
        </p>
      )}
    </section>
  );
}
