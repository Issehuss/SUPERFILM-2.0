// src/hooks/useEntitlements.js
import { useEffect, useMemo, useState } from "react";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";

/**
 * Returns:
 *  - limits: { plan?, isPremium? }
 *  - presidentsClubs: [{ id, slug, name }]
 *  - isPresidentOfClub: (clubIdOrSlug) => boolean
 */
export default function useEntitlements() {
  const { user, profile } = useUser();
  const [presidentsClubs, setPresidentsClubs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Derive premium from profile (support either `plan` or `is_premium`)
  const plan = (profile?.plan || "").toLowerCase();
  const isPremium = plan === "directors_cut" || !!profile?.is_premium;

  useEffect(() => {
    if (!user?.id) { setPresidentsClubs([]); return; }
    let mounted = true;
    (async () => {
      setLoading(true);
      // Expect a club_members table: (club_id, user_id, role, club_slug?)
      const { data } = await supabase
        .from("club_members")
        .select("club_id, role, clubs:club_id (id, slug, name)")
        .eq("user_id", user.id)
        .eq("role", "president");

      if (!mounted) return;
      const rows = Array.isArray(data) ? data : [];
      const mapped = rows
        .map(r => ({
          id: r?.clubs?.id || r.club_id,
          slug: r?.clubs?.slug || null,
          name: r?.clubs?.name || "Club",
        }))
        .filter(c => c.id);
      setPresidentsClubs(mapped);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [user?.id]);

  const idOrSlugMatch = (clubIdOrSlug, c) =>
    !clubIdOrSlug ? false :
    String(c.id) === String(clubIdOrSlug) || (c.slug && String(c.slug) === String(clubIdOrSlug));

  const isPresidentOfClub = useMemo(() => {
    return (clubIdOrSlug) => presidentsClubs.some(c => idOrSlugMatch(clubIdOrSlug, c));
  }, [presidentsClubs]);

  const limits = { plan: plan || (isPremium ? "directors_cut" : "free"), isPremium };

  return { limits, presidentsClubs, isPresidentOfClub, loading };
}
