// src/pages/UserFilmTakes.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
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

  const loadNextPage = useCallback(async () => {
    if (!profile?.id || loadingPage || !hasMore) return;
    setLoadingPage(true);

    try {
      const from = pageRef.current * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("film_takes")
        .select("*")
        .eq("user_id", profile.id)
        .eq("visibility", "public") // public-only for MVP
        .order("updated_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const rows = Array.isArray(data) ? data : [];
      setTakes((prev) => [...prev, ...rows]);
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

  // First page when profile is ready
  useEffect(() => {
    if (profile?.id && !initialLoaded && !loadingPage) {
      loadNextPage();
    }
  }, [profile?.id, initialLoaded, loadingPage, loadNextPage]);

  // IntersectionObserver for infinite scroll
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

  return (
    <div className="w-full min-h-screen bg-black text-white py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header / breadcrumb */}
        <div className="mb-6 flex items-center justify-between gap-3">
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
            <h1 className="text-xl font-semibold">
              {displayName}
              <span className="text-zinc-400 text-sm ml-2">
                / Film Takes
              </span>
            </h1>
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

        {/* Grid of takes */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {takes.map((take) => (
            <FilmTakeCard key={take.id} take={take} />
          ))}
        </div>

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-10 w-full" />

        {loadingPage && (
          <div className="mt-4 text-xs text-zinc-500">
            Loading more takes…
          </div>
        )}

        {!loadingPage && initialLoaded && takes.length === 0 && (
          <div className="mt-8 text-sm text-zinc-400">
            No public film takes yet.
          </div>
        )}
      </div>
    </div>
  );
}
