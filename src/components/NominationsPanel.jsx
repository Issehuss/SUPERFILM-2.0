// src/components/NominationsPanel.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import supabase from "../supabaseClient.js";

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function NominationsPanel({ clubId: propClubId, limit = 12 }) {
  const { clubParam, id: legacyId } = useParams();
  const routeParam = (clubParam || legacyId || "").trim();

  const [resolvedClubId, setResolvedClubId] = useState(propClubId || null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");

  // Resolve the actual club UUID:
  // - if a prop was passed, use it
  // - else, if the route param is a UUID, use it
  // - else, treat the route param as a slug and look up the club.id
  useEffect(() => {
    let cancelled = false;

    async function resolveClubId() {
      setError("");
      // prop wins
      if (propClubId) {
        setResolvedClubId(propClubId);
        return;
      }

      if (!routeParam) {
        setResolvedClubId(null);
        return;
      }

      // UUID directly from the URL
      if (UUID_RX.test(routeParam)) {
        setResolvedClubId(routeParam);
        return;
      }

      // Otherwise assume it's a slug → fetch id
      try {
        setResolving(true);
        const { data, error } = await supabase
          .from("clubs")
          .select("id")
          .eq("slug", routeParam)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          setError(error.message || "Could not resolve club by slug.");
          setResolvedClubId(null);
        } else if (data?.id) {
          setResolvedClubId(data.id);
        } else {
          setResolvedClubId(null);
        }
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

  // Load nominations for the resolved club id
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        if (!resolvedClubId) {
          setItems([]);
          return;
        }

        if (supabase) {
          // ✅ Query the aggregated VIEW (no .group() in JS)
          const { data, error } = await supabase
            .from("nominations_by_film")
            .select("movie_id, movie_title, poster_path, upvotes, last_nomination_at")
            .eq("club_id", resolvedClubId)
            .order("upvotes", { ascending: false })
            .order("last_nomination_at", { ascending: false })
            .limit(limit);

          if (!cancelled) {
            if (error) {
              setError(error.message || "Could not load nominations.");
              setItems([]);
            } else {
              setItems(data || []);
            }
          }
          return;
        }

        // local fallback (if supabase not available for any reason)
        const key = `nominations:${resolvedClubId}`;
        const local = JSON.parse(localStorage.getItem(key) || "[]");
        if (!cancelled) setItems(local.slice(0, limit));
      } catch (e) {
        if (!cancelled) {
          console.warn("[NominationsPanel] load error:", e);
          setError(e?.message || "Failed to load nominations.");
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [resolvedClubId, limit]);

  // Optional: realtime refresh when rows change
  useEffect(() => {
    if (!resolvedClubId) return;
    const channel = supabase
      .channel(`nominations:${resolvedClubId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "nominations", filter: `club_id=eq.${resolvedClubId}` },
        () => {
          // simple: reload the VIEW when the base table changes
          (async () => {
            const { data } = await supabase
              .from("nominations_by_film")
              .select("movie_id, movie_title, poster_path, upvotes, last_nomination_at")
              .eq("club_id", resolvedClubId)
              .order("upvotes", { ascending: false })
              .order("last_nomination_at", { ascending: false })
              .limit(limit);
            setItems(data || []);
          })();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolvedClubId, limit]);

  // Render
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

      {error && (
        <p className="text-sm text-red-400 mt-2">{error}</p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-zinc-900/60 ring-1 ring-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : items?.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-3">
          {items.map((n) => (
            <div
              key={n.movie_id}
              className="rounded-2xl overflow-hidden bg-zinc-900/60 ring-1 ring-zinc-800"
              title={n.movie_title}
            >
              <img
                src={
                  n.poster_path
                    ? `https://image.tmdb.org/t/p/w342${n.poster_path}`
                    : "/fallback-next.jpg"
                }
                alt={n.movie_title}
                className="h-48 w-full object-cover"
                loading="lazy"
              />
              <div className="p-3">
                <p className="text-sm text-white line-clamp-2">{n.movie_title}</p>
                {"upvotes" in n && (
                  <p className="text-xs text-zinc-400 mt-1">Upvotes: {n.upvotes ?? 0}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-400 mt-2">
          No nominations yet. Nominate a film from its details page.
        </p>
      )}
    </section>
  );
}



