import { useEffect, useState } from "react";
import supabase from "../supabaseClient";

export default function useMyClub(userId) {
  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState(null); // { id, slug } or null
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!userId) {
        setClub(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("club_members")
          .select("club_id, clubs:club_id(id, slug)")
          .eq("user_id", userId)
          .limit(1);

        if (cancelled) return;

        if (error) throw error;

        const row = data?.[0];
        if (row?.clubs?.id) {
          const found = { id: row.clubs.id, slug: row.clubs.slug || row.clubs.id };
          setClub(found);
          localStorage.setItem("activeClubId", String(found.id));
          localStorage.setItem("activeClubSlug", String(found.slug));
          localStorage.setItem("myClubId", String(found.slug));
        } else {
          setClub(null);
          localStorage.removeItem("activeClubId");
          localStorage.removeItem("activeClubSlug");
          localStorage.removeItem("myClubId");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e);
          setClub(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [userId]);

  return { loading, club, error, hasClub: !!club };
}
