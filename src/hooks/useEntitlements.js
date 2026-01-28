// src/hooks/useEntitlements.js
import { useEffect, useMemo, useState, useCallback } from "react";
import supabase from "lib/supabaseClient";
import { useUser } from "../context/UserContext";
import { trackEvent } from "../lib/analytics";

/**
 * Returns:
 *  - limits: { plan, isPremium, limitForPlan }
 *  - presidentsClubs: [{ id, slug, name }]
 *  - isPresidentOfClub(clubIdOrSlug)
 *  - getOwnedClubsCount()
 *  - canCreateAnotherClub()  → calls the RPC guard
 */
export default function useEntitlements() {
  const { user, profile } = useUser();
  const [presidentsClubs, setPresidentsClubs] = useState([]);
  const [loading, setLoading] = useState(false);
  const limitHitRef = useMemo(() => ({ moodboard: false, clubs: false }), []);
  const resolveUserId = useCallback(async () => {
    const { data: auth } = await supabase.auth.getSession();
    return user?.id || auth?.session?.user?.id || null;
  }, [user?.id]);

  const waitForUserId = useCallback(async () => {
    let id = await resolveUserId();
    let tries = 0;
    while (!id && tries < 10) {
      await new Promise((r) => setTimeout(r, 500));
      id = await resolveUserId();
      tries += 1;
    }
    return id;
  }, [resolveUserId]);

  // ─────────────────────────────── Plan derivation ───────────────────────────────
  const normalizePlan = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  const plan = normalizePlan(profile?.plan);
  const isPremium =
    profile?.is_premium === true ||
    plan === "directors_cut" ||
    plan === "premium";
  const resolvedPlan = plan || (isPremium ? "directors_cut" : "free");

  // Define limits per plan (client-side mirror of the DB function)
  const LIMITS = {
    free: { clubs: 3, moodboardTiles: 6 },
    directors_cut: { clubs: 10, moodboardTiles: Number.POSITIVE_INFINITY },
  };
  const limitForPlan = LIMITS[resolvedPlan]?.clubs ?? LIMITS.free.clubs;
  const moodboardTiles = LIMITS[resolvedPlan]?.moodboardTiles ?? LIMITS.free.moodboardTiles;

  // ─────────────────────────────── Fetch owned clubs ───────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let retryTimer;

    const load = async () => {
      setLoading(true);
      const resolvedUserId = await resolveUserId();
      if (!resolvedUserId) {
        if (!cancelled) {
          setPresidentsClubs([]);
          retryTimer = setTimeout(load, 500);
        }
        return;
      }

      const { data, error } = await supabase
        .from("club_members")
        .select("club_id, user_id, role, joined_at, accepted")
        .eq("user_id", resolvedUserId)
        .eq("role", "president");

      if (cancelled) return;
      if (error) console.error("Error loading president clubs:", error);

      const rows = Array.isArray(data) ? data : [];
      const clubIds = rows.map((r) => r.club_id).filter(Boolean);
      let clubsMap = {};
      if (clubIds.length) {
        const { data: clubsData } = await supabase
          .from("clubs_public")
          .select("id, slug, name")
          .in("id", clubIds);
        clubsMap = (clubsData || []).reduce((acc, c) => {
          acc[c.id] = c;
          return acc;
        }, {});
      }
      const mapped = rows
        .map((r) => {
          const c = clubsMap[r.club_id] || {};
          return {
            id: r.club_id,
            slug: c.slug || null,
            name: c.name || "Club",
          };
        })
        .filter((c) => c.id);
      setPresidentsClubs(mapped);
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [resolveUserId]);

  // ─────────────────────────────── Helpers ───────────────────────────────
  const idOrSlugMatch = (clubIdOrSlug, c) =>
    !!clubIdOrSlug &&
    (String(c.id) === String(clubIdOrSlug) ||
      (c.slug && String(c.slug) === String(clubIdOrSlug)));

  const isPresidentOfClub = useMemo(
    () => (clubIdOrSlug) => presidentsClubs.some((c) => idOrSlugMatch(clubIdOrSlug, c)),
    [presidentsClubs]
  );

  // Count owned clubs (local)
  async function getOwnedClubsCount() {
    const resolvedUserId = await waitForUserId();
    if (!resolvedUserId) return 0;
    const { count, error } = await supabase
      .from("club_members")
      .select("club_id, user_id, role, joined_at, accepted", { count: "exact", head: true })
      .eq("user_id", resolvedUserId)
      .eq("role", "president");
    if (error) {
      console.error("Error counting owned clubs:", error);
      return 0;
    }
    return count ?? 0;
  }

  // Check via RPC if user can create another club (matches RLS guard)
  async function canCreateAnotherClub() {
    const resolvedUserId = await waitForUserId();
    if (!resolvedUserId) return false;
    const { data, error } = await supabase.rpc("can_create_club");
    if (error) {
      console.error("RPC can_create_club error:", error);
      return false;
    }
    if (data === false && !limitHitRef.clubs) {
      trackEvent("limit_hit", { feature: "clubs", plan: resolvedPlan || "free" });
      limitHitRef.clubs = true;
    }
    return Boolean(data);
  }

  // ─────────────────────────────── Return ───────────────────────────────
  const limits = {
    plan: resolvedPlan,
    isPremium,
    limitForPlan,
    moodboardTiles,
  };

  return {
    limits,
    presidentsClubs,
    isPresidentOfClub,
    getOwnedClubsCount,
    canCreateAnotherClub,
    loading,
  };
}
