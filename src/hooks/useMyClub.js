// Fetch a user's club memberships and expose the first (primary) club.
import { useEffect, useState } from "react";
import supabase from "../supabaseClient";

const CACHE_KEY = "cache:myClub:v1";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function readCache(userId) {
  if (!userId) return null;
  try {
    const raw = sessionStorage.getItem(`${CACHE_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || !parsed?.club) return null;
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.club;
  } catch {
    return null;
  }
}

function writeCache(userId, club) {
  if (!userId) return;
  try {
    sessionStorage.setItem(
      `${CACHE_KEY}:${userId}`,
      JSON.stringify({ at: Date.now(), club })
    );
  } catch {
    /* ignore cache write failures */
  }
}

export default function useMyClub(userId) {
  const cached = readCache(userId);
  const [clubs, setClubs] = useState(cached ? [cached] : []);
  const [club, setClub] = useState(cached || null);
  const [loading, setLoading] = useState(!!userId && !cached);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const cachedClub = readCache(userId);
    if (cachedClub) {
      setClub(cachedClub);
      setClubs([cachedClub]);
      setLoading(false);
    }

    async function run() {
      if (!userId) {
        setClubs([]);
        setClub(null);
        setLoading(false);
        return;
      }

      setLoading((prev) => prev || !cachedClub);
      try {
        const { data, error: qErr } = await supabase
          .from("club_members")
          .select(`
            club_id,
            role,
            clubs:club_id (
              id,
              slug,
              name,
              profile_image_url,
              banner_url,
              next_screening:club_next_screening (
                film_title,
                screening_at,
                location
              )
            )
          `)
          .eq("user_id", userId);

        if (qErr) throw qErr;

        if (!cancelled) {
          const list = (data || [])
            .map((row) => {
              const clubData = row.clubs || {};
              const nextScreening = Array.isArray(clubData.next_screening)
                ? clubData.next_screening[0]
                : clubData.next_screening;
              return {
                ...clubData,
                role: row.role,
                next_screening: nextScreening || null,
              };
            })
            .filter((c) => c.id);
          setClubs(list);
          setClub(list[0] || null);
          writeCache(userId, list[0] || null);
        }
      } catch (e) {
        console.warn("[useMyClub] fetch failed:", e.message);
        if (!cancelled) {
          setError(e);
          setClubs([]);
          setClub(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { club, clubs, loading, error };
}
