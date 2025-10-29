// src/components/ClubFilmTakesSection.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import supabase from "../supabaseClient";

export default function ClubFilmTakesSection({
  clubId,
  filmId,
  canSeeMembersOnly,
  rotateMs = 8000,
}) {
  const [takes, setTakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  // --- fetcher lives INSIDE the component so we can reference it from effects
  async function fetchTakes() {
    if (!clubId || !filmId) {
      setTakes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase
        .from("club_film_takes")
        .select(`
          id, rating, take, created_at,
          profiles:profiles!user_id ( display_name, avatar_url )
        `)
        .eq("club_id", clubId)
        .eq("film_id", filmId)
        .eq("is_archived", false)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setTakes(Array.isArray(data) ? data : []);
      setIndex(0); // reset spotlight to first whenever list changes
    } catch (e) {
      setErr(e?.message || "Failed to load film takes");
    } finally {
      setLoading(false);
    }
  }

  // initial + whenever inputs change
  useEffect(() => {
    fetchTakes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, filmId]);

  // refresh when someone posts a take (from ClubAddTake)
  useEffect(() => {
    function onUpdated(e) {
      if (e?.detail?.clubId === clubId && e?.detail?.filmId === filmId) {
        fetchTakes();
      }
    }
    window.addEventListener("club-film-takes-updated", onUpdated);
    return () => window.removeEventListener("club-film-takes-updated", onUpdated);
  }, [clubId, filmId]);

  // auto-rotate spotlight
  const safeTakes = useMemo(() => takes.filter(Boolean), [takes]);
  useEffect(() => {
    clearInterval(timerRef.current);
    if (!safeTakes.length) return;
    timerRef.current = setInterval(
      () => setIndex((i) => (i + 1) % safeTakes.length),
      rotateMs
    );
    return () => clearInterval(timerRef.current);
  }, [safeTakes.length, rotateMs]);

  if (!canSeeMembersOnly) {
    return (
      <div className="mt-3 rounded-xl border border-zinc-800 bg-black/40 p-3 text-sm text-zinc-400">
        Film Takes are for members.
      </div>
    );
  }

  return (
    <div className="mt-3">
      <h3 className="text-sm font-semibold text-yellow-400 mb-2">Film Takes</h3>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 animate-pulse text-sm text-zinc-400">
          Loading takes…
        </div>
      ) : err ? (
        <div className="rounded-2xl border border-red-900/60 bg-red-900/20 p-4 text-sm text-red-300">
          {err}
        </div>
      ) : safeTakes.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-300">
          No takes yet — be the first to share your thoughts.
        </div>
      ) : (
        <SpotlightCard take={safeTakes[index]} count={safeTakes.length} index={index} />
      )}
    </div>
  );
}

function SpotlightCard({ take, count, index }) {
  const name = take?.profiles?.display_name || "Member";
  const avatar = take?.profiles?.avatar_url || "/avatar_placeholder.png";
  const rating =
    typeof take?.rating === "number" && !Number.isNaN(take.rating)
      ? take.rating.toFixed(1)
      : null;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-5 transition-colors">
      <div className="flex items-start gap-3">
        <img
          src={avatar}
          alt={name}
          className="h-10 w-10 rounded-full object-cover"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/avatar_placeholder.png";
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="truncate font-semibold text-white">{name}</div>
            {rating && (
              <div className="shrink-0 rounded-full border border-yellow-500/30 px-2 py-0.5 text-xs text-yellow-400">
                ⭐ {rating}/10
              </div>
            )}
          </div>
          <p className="mt-2 line-clamp-5 text-zinc-200">{take?.take || "—"}</p>
        </div>
      </div>

      {count > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {Array.from({ length: count }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-6 rounded-full transition-opacity ${
                i === index ? "bg-yellow-400 opacity-100" : "bg-white/20 opacity-50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
