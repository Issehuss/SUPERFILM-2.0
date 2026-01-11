// src/hooks/useStaff.js
import { useEffect, useState } from "react";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";

export default function useStaff(clubId) {
  const { user } = useUser();
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!user?.id || !clubId || !/^[0-9a-f-]{16,}$/i.test(String(clubId))) {
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

        // leader (president / vp)
        const { data: memRow } = await supabase
          .from("club_members")
          .select("role")
          .eq("club_id", clubId)
          .eq("user_id", user.id)
          .maybeSingle();
        const leader = ["president","vice_president"].includes(memRow?.role);

        const result = partner || leader;

        if (!cancelled) {
          setIsStaff(result);
          setLoading(false);
        }

        // Debug
        if (process.env.NODE_ENV === "development") {
          console.log("[useStaff]", {
            clubId,
            partner,
            staffRole: null, // no club_staff table
            memberRole: memRow?.role || null,
            result
          });
        }
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
