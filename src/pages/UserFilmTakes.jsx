// src/pages/UserFilmTakes.jsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronDown, Search } from "lucide-react";
import supabase from "../supabaseClient";
import FilmTakeCard from "../components/FilmTakeCard.jsx";

const UUID_RX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadProfileByIdentifier(identifier) {
  if (!identifier) return null;
  try {
    if (UUID_RX.test(String(identifier))) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", identifier)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("slug", String(identifier))
      .maybeSingle();
    if (error) throw error;
    return data || null;
  } catch (e) {
    console.error("[UserFilmTakes] load profile failed:", e);
    return null;
  }
}

const PAGE_SIZE = 12;

export default function UserFilmTakes() {
  const { slug, id } = useParams();

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [takes, setTakes] = useState([]);
  const [loadingPage, setLoadingPage] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");

  const sentinelRef = useRef(null);
  const pageRef = useRef(0);

  // Load the profile for this slug / id
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setProfileLoading(true);
      const identifier = slug || id || null;
      const p = await loadProfileByIdentifier(identifier);
      if (cancelled) return;
      setProfile(p);
      setProfileLoading(false);
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [slug, id]);

  // ---- Load Film Takes (Unified from club_film_takes table) ----
  const loadNextPage = useCallback(async () => {
    if (!profile?.id || loadingPage || !hasMore) return;
    setLoadingPage(true);

    try {
      const from = pageRef.current * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("club_film_takes")
        .select("*")
        .eq("user_id", profile.id)
        .eq("is_archived", false)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];

      // Normalize shape for FilmTakeCard
      const normalized = rows.map((t) => {
        const rawRating =
          typeof t.rating === "number"
            ? t.rating
            : typeof t.rating_5 === "number"
            ? t.rating_5
            : null;
        const rating =
          rawRating == null
            ? null
            : rawRating > 5
            ? Number((rawRating / 2).toFixed(1))
            : Number(rawRating.toFixed(1));

        return {
        id: t.id,
        user_id: t.user_id,
        club_id: t.club_id,
        film_id: t.film_id,
        film_title: t.film_title,
        title: t.film_title || t.title || "",
        text: t.take || t.text || "",
        rating,
        aspect_key: t.aspect_key,
        poster_path: t.poster_path,
        created_at: t.created_at,
        screening_id: t.screening_id,
      };
      });

      setTakes((prev) => [...prev, ...normalized]);
      pageRef.current += 1;

      if (rows.length < PAGE_SIZE) {
        setHasMore(false);
      }
      setInitialLoaded(true);
    } catch (e) {
      console.error("[UserFilmTakes] load page failed:", e);
      setHasMore(false);
      setInitialLoaded(true);
    } finally {
      setLoadingPage(false);
    }
  }, [profile?.id, loadingPage, hasMore]);

  // First page when ready
  useEffect(() => {
    if (profile?.id && !initialLoaded && !loadingPage) {
      loadNextPage();
    }
  }, [profile?.id, initialLoaded, loadingPage, loadNextPage]);

  // IntersectionObserver infinite scroll
  useEffect(() => {
    if (!hasMore || loadingPage) return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          loadNextPage();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadingPage, loadNextPage]);

  const displayName =
    profile?.display_name || profile?.slug || "Profile";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? takes.filter((t) => {
          const title = (t.title || t.film_title || "").toLowerCase();
          const text = (t.text || t.take || "").toLowerCase();
          return title.includes(q) || text.includes(q);
        })
      : takes;

    if (sort === "rating") {
      return [...base].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    if (sort === "title") {
      return [...base].sort((a, b) =>
        (a.title || "").localeCompare(b.title || "")
      );
    }
    return base;
  }, [takes, query, sort]);

  const uniqueFilmCount = useMemo(() => {
    const seen = new Set();
    takes.forEach((t) => {
      const key =
        (t.film_id !== null && t.film_id !== undefined
          ? `id:${t.film_id}`
          : null) ||
        (t.film_title
          ? `title:${t.film_title.trim().toLowerCase()}`
          : null) ||
        (t.title ? `title:${t.title.trim().toLowerCase()}` : null);
      if (key) seen.add(key);
    });
    return seen.size;
  }, [takes]);

  return (
    <div className="w-full min-h-screen bg-black text-white py-8 px-3 sm:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-zinc-500 mb-1">
              <Link
                to={
                  profile?.slug
                    ? `/u/${profile.slug}`
                    : profile?.id
                    ? `/profile/${profile.id}`
                    : "/myprofile"
                }
                className="hover:text-yellow-400"
              >
                ← Back to profile
              </Link>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold">
              {displayName}
              <span className="text-zinc-400 text-sm ml-2">
                / Film Takes
              </span>
            </h1>
          </div>
          <div className="text-xs text-zinc-400 whitespace-nowrap">
            {uniqueFilmCount} {uniqueFilmCount === 1 ? "film" : "films"} logged
          </div>
        </div>

        <section className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/80">
          <div className="absolute -top-16 right-6 h-40 w-40 rounded-full bg-yellow-400/10 blur-3xl" />
          <div className="absolute -bottom-20 left-6 h-44 w-44 rounded-full bg-white/5 blur-3xl" />
          <div className="relative p-5 sm:p-7">
            <div className="text-[11px] uppercase tracking-[0.28em] text-zinc-400">
              Film takes
            </div>
            <div className="mt-2 text-xl sm:text-3xl font-semibold text-white">
              Every take you’ve shared, all in one place.
            </div>
            <div className="mt-2 text-sm sm:text-base text-zinc-400 max-w-2xl">
              Scan your latest reactions, revisit your ratings, and see how your
              taste evolves over time.
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-[11px] uppercase tracking-wide rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-200">
                {takes.length} takes
              </span>
              <span className="text-[11px] uppercase tracking-wide rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-200">
                {uniqueFilmCount} films
              </span>
            </div>
          </div>
        </section>

        <div className="mt-5 sm:mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-2 backdrop-blur">
            <Search size={16} className="text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search takes by film or text"
              className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
            />
          </div>

          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-10 appearance-none rounded-full border border-white/10 bg-black/40 pl-4 pr-9 text-sm text-zinc-200 backdrop-blur focus:outline-none"
            >
              <option value="recent">Most recent</option>
              <option value="rating">Highest rated</option>
              <option value="title">Title A–Z</option>
            </select>
            <ChevronDown
              size={16}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
          </div>
        </div>

        {profileLoading && (
          <div className="text-sm text-zinc-400">
            Loading profile…
          </div>
        )}

        {!profileLoading && !profile && (
          <div className="text-sm text-red-400">
            Profile not found.
          </div>
        )}

        <div className="mt-4 text-sm text-zinc-400">
          {loadingPage && !initialLoaded
            ? "Loading takes..."
            : `${filtered.length} results`}
        </div>

        {/* Grid */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((take) => (
            <FilmTakeCard key={take.id} take={take} />
          ))}
        </div>

        {/* Infinite Scroll Sentinel */}
        <div ref={sentinelRef} className="h-10 w-full" />

        {loadingPage && (
          <div className="mt-4 text-xs text-zinc-500">
            Loading more takes…
          </div>
        )}

        {!loadingPage && initialLoaded && filtered.length === 0 && (
          <div className="mt-8 text-sm text-zinc-300 rounded-2xl border border-zinc-800 bg-black/40 p-4">
            <div className="font-medium text-white mb-1">
              No film takes yet.
            </div>
            <p className="text-zinc-400 text-xs">
              Share your first take after a club screening to see it appear here. Your reviews will help your clubs and friends discover more great films.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
