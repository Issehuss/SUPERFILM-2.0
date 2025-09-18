// src/pages/MyClubGate.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";

export default function MyClubGate() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Not signed in → go to clubs list
      if (!user?.id) {
        if (!cancelled) {
          navigate("/clubs", { replace: true });
          setDone(true);
        }
        return;
      }

      // Fast path: use cached slug/id if we have it
      const cachedSlug = localStorage.getItem("activeClubSlug") || localStorage.getItem("myClubSlug");
      const cachedId   = localStorage.getItem("activeClubId")   || localStorage.getItem("myClubId");
      if (!cancelled && (cachedSlug || cachedId)) {
        navigate(`/clubs/${cachedSlug || cachedId}`, { replace: true });
        setDone(true);
        return;
      }

      // 1) Find one membership for this user (no joins to avoid policy recursion)
      const { data: mem, error: mErr } = await supabase
        .from("club_members")
        .select("club_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (mErr || !mem?.club_id) {
        // No club yet → go to clubs list
        if (!cancelled) {
          navigate("/clubs", { replace: true });
          setDone(true);
        }
        return;
      }

      // 2) Get slug for that club
      const { data: club, error: cErr } = await supabase
        .from("clubs")
        .select("id, slug")
        .eq("id", mem.club_id)
        .maybeSingle();

      if (!cancelled) {
        const dest = `/clubs/${club?.slug || club?.id || mem.club_id}`;
        // cache for next time
        try {
          if (club?.slug) localStorage.setItem("myClubSlug", club.slug);
          localStorage.setItem("myClubId", club?.id || mem.club_id);
        } catch {}
        navigate(dest, { replace: true });
        setDone(true);
      }
    })();

    return () => { cancelled = true; };
  }, [user, navigate]);

  // Tiny placeholder (renders only for a split second)
  if (done) return null;
  return (
    <div className="text-zinc-400 p-6">Loading your club…</div>
  );
}
