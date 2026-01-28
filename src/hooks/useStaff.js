// src/hooks/useStaff.js
import { useEffect, useState } from "react";
import supabase from "lib/supabaseClient";
import { useUser } from "../context/UserContext";

export default function useStaff(clubId) {
  const { user } = useUser();
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let retryTimer;

    async function run() {
      const { data: auth } = await supabase.auth.getSession();
      const sessionUserId = auth?.session?.user?.id || null;
      const resolvedUserId = user?.id || sessionUserId;
      if (!resolvedUserId || !clubId || !/^[0-9a-f-]{16,}$/i.test(String(clubId))) {
        if (!cancelled) {
          setIsStaff(false);
          setLoading(false);
          if (!resolvedUserId) retryTimer = setTimeout(run, 500);
        }
        return;
      }
      setLoading(true);

      try {
        // global partner?
        const { data: prof } = await supabase
          .from("profiles")
          .select("is_partner")
          .eq("id", resolvedUserId)
          .maybeSingle();
        const partner = !!prof?.is_partner;

        // leader (president / vp)
        const { data: memRow } = await supabase
          .from("club_members")
          .select("club_id, user_id, role, joined_at, accepted")
          .eq("club_id", clubId)
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
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [user?.id, clubId]);

  return { isStaff, loading };
}
