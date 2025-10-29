// src/hooks/useStaff.js
import { useEffect, useState } from "react";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";

export default function useStaff(clubId) {
  const { user } = useUser();
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);
  const STAFF_ROLES = new Set(["president","vice_president","admin","moderator","partner"]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!user?.id || !clubId) {
        if (!cancelled) { setIsStaff(false); setLoading(false); }
        return;
      }
      setLoading(true);

      try {
        // global partner?
        const { data: prof } = await supabase
          .from("profiles")
          .select("is_partner")
          .eq("id", user.id)
          .maybeSingle();
        const partner = !!prof?.is_partner;

        // explicit staff?
        const { data: staffRow } = await supabase
          .from("club_staff")
          .select("role")
          .eq("club_id", clubId)
          .eq("user_id", user.id)
          .maybeSingle();
        const staff = !!staffRow;

        // leader?
        const { data: memRow } = await supabase
          .from("club_members")
          .select("role")
          .eq("club_id", clubId)
          .eq("user_id", user.id)
          .maybeSingle();
        const leader = ["president","vice_president","editor_in_chief"].includes(memRow?.role);

        const result = partner || staff || leader;

        if (!cancelled) {
          setIsStaff(result);
          setLoading(false);
        }

        // TEMP: see exactly why (remove when done)
        console.log("[useStaff]", {
          clubId, partner, staffRole: staffRow?.role || null, memberRole: memRow?.role || null, result
        });
      } catch (e) {
        if (!cancelled) {
          console.warn("[useStaff] error:", e?.message || e);
          setIsStaff(false);
          setLoading(false);
        }
      }
    }

    run();
    return () => { cancelled = true; };
  }, [user?.id, clubId]);

  return { isStaff, loading };
}
