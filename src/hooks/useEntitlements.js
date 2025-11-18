// src/hooks/useEntitlements.js
import { useEffect, useMemo, useState } from "react";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";

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

  // ─────────────────────────────── Plan derivation ───────────────────────────────
  const plan = (profile?.plan || "").toLowerCase();
  const isPremium = plan === "directors_cut" || !!profile?.is_premium;
  const resolvedPlan = plan || (isPremium ? "directors_cut" : "free");

  // Define limits per plan (client-side mirror of the DB function)
  const LIMITS = { free: 1, directors_cut: 5 };
  const limitForPlan = LIMITS[resolvedPlan] ?? LIMITS.free;

  // ─────────────────────────────── Fetch owned clubs ───────────────────────────────
  useEffect(() => {
    if (!user?.id) {
      setPresidentsClubs([]);
      return;
    }
    let mounted = true;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("club_members")
        .select("club_id, role, clubs:club_id (id, slug, name)")
        .eq("user_id", user.id)
        .eq("role", "president");

      if (!mounted) return;
      if (error) console.error("Error loading president clubs:", error);

      const rows = Array.isArray(data) ? data : [];
      const mapped = rows
        .map((r) => ({
          id: r?.clubs?.id || r.club_id,
          slug: r?.clubs?.slug || null,
          name: r?.clubs?.name || "Club",
        }))
        .filter((c) => c.id);
      setPresidentsClubs(mapped);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

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
    if (!user?.id) return 0;
    const { count, error } = await supabase
      .from("club_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "president");
    if (error) {
      console.error("Error counting owned clubs:", error);
      return 0;
    }
    return count ?? 0;
  }

  // Check via RPC if user can create another club (matches RLS guard)
  async function canCreateAnotherClub() {
    if (!user?.id) return false;
    const { data, error } = await supabase.rpc("can_create_club");
    if (error) {
      console.error("RPC can_create_club error:", error);
      return false;
    }
    return Boolean(data);
  }

  // ─────────────────────────────── Return ───────────────────────────────
  const limits = {
    plan: resolvedPlan,
    isPremium,
    limitForPlan,
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
