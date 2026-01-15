// src/pages/ClubTakesArchive.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import supabase from "../supabaseClient";
import DirectorsCutBadge from "../components/DirectorsCutBadge";

const normalizePoster = (posterPath) => {
  if (!posterPath) return null;
  if (posterPath.startsWith("http")) return posterPath;
  if (posterPath.startsWith("/")) {
    return `https://image.tmdb.org/t/p/w342${posterPath}`;
  }
  return null;
};

export default function ClubTakesArchive() {
  const { clubParam } = useParams();
  const navigate = useNavigate();
  const isUuid = (value) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(value || "")
    );

  const [club, setClub] = useState(null);
  const [takes, setTakes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError("");

        // 1) Load club by slug or id
        const clubQuery = supabase
          .from("clubs")
          .select("id, slug, name, banner_url, profile_image_url");
        const { data: clubRow, error: clubErr } = await (isUuid(clubParam)
          ? clubQuery.eq("id", clubParam)
          : clubQuery.eq("slug", clubParam)
        ).maybeSingle();

        if (clubErr) throw clubErr;
        if (!clubRow) {
          if (active) {
            setError("Club not found.");
            setLoading(false);
          }
          return;
        }

        if (active) setClub(clubRow);

        // 2) Load archived takes
        const { data: rows, error: takeErr } = await supabase
          .from("club_film_takes")
          .select(
            `
            id, film_id, film_title, poster_path, rating, take, created_at,
            profiles:profiles!user_id ( display_name, avatar_url, slug, is_premium, plan )
          `
          )
          .eq("club_id", clubRow.id)
          .eq("is_archived", true)
          .order("film_title", { ascending: true })
          .order("created_at", { ascending: false });

        if (takeErr) throw takeErr;
        if (active) setTakes(rows || []);
      } catch (err) {
        if (active) setError(err?.message || "Failed to load archive.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [clubParam]);

  const grouped = useMemo(() => {
    const map = new Map();
    takes.forEach((t) => {
      const key = t.film_id || t.film_title || "unknown";
      if (!map.has(key)) {
        map.set(key, {
          filmId: t.film_id || null,
          filmTitle: t.film_title || "Untitled film",
          poster: normalizePoster(t.poster_path),
          takes: [],
        });
      }
      map.get(key).takes.push(t);
    });
    return Array.from(map.values());
  }, [takes]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-zinc-400 uppercase tracking-[0.2em]">
              {club ? club.name : "Club"}
            </p>
            <h1 className="text-3xl font-bold">Archived Film Takes</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Past takes grouped by film. Only archived entries are shown here.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-200 hover:border-yellow-400 hover:text-white transition"
            >
              ← Back
            </button>
            <Link
              to={`/clubs/${clubParam}`}
              className="rounded-full bg-yellow-500 text-black text-sm font-semibold px-3 py-1.5 hover:bg-yellow-400 transition"
            >
              Club profile
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-xl border border-zinc-800 bg-zinc-900 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-600/40 bg-red-600/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-6 text-sm text-zinc-400">
            No archived film takes yet.
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((film) => (
              <div
                key={`${film.filmId || film.filmTitle}`}
                className="rounded-2xl border border-zinc-800 bg-black/40 p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  {film.poster ? (
                    <img
                      src={film.poster}
                      alt={film.filmTitle}
                      className="h-16 w-11 rounded-lg object-cover border border-zinc-800"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-16 w-11 rounded-lg border border-zinc-800 bg-zinc-900" />
                  )}
                  <div>
                    <h3 className="text-lg font-semibold">{film.filmTitle}</h3>
                    {film.filmId ? (
                      <Link
                        to={`/movies/${film.filmId}`}
                        className="text-xs text-yellow-400 hover:text-yellow-300"
                      >
                        View movie →
                      </Link>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-3">
                  {film.takes.map((take) => (
                    <div
                      key={take.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"
                    >
                      <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                        <div className="flex items-center gap-2">
                          {take.profiles?.avatar_url ? (
                            <img
                              src={take.profiles.avatar_url}
                              alt=""
                              className="h-6 w-6 rounded-full object-cover border border-zinc-800"
                            />
                          ) : (
                            <span className="h-6 w-6 rounded-full bg-zinc-800 inline-block" />
                          )}
                          <span className="text-zinc-200 flex items-center gap-2">
                            <span className="truncate">
                              {take.profiles?.display_name || "Member"}
                            </span>
                            {(take.profiles?.is_premium === true ||
                              String(take.profiles?.plan || "").toLowerCase() === "directors_cut") && (
                              <DirectorsCutBadge className="ml-0" size="xs" />
                            )}
                          </span>
                        </div>
                        <span>{new Date(take.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-zinc-200 whitespace-pre-wrap">
                        {take.take || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
