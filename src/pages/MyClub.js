// src/pages/MyClub.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import supabase from "../supabaseClient.js";

export default function MyClub() {
  const navigate = useNavigate();
  const { user, loading } = useUser();

  const [fetching, setFetching] = useState(false);
  const [clubIds, setClubIds] = useState([]);
  const [timeoutHit, setTimeoutHit] = useState(false);
  const [didFastRedirect, setDidFastRedirect] = useState(false);
  const [didVerifiedRedirect, setDidVerifiedRedirect] = useState(false);

  /**
   * Fast path: if signed in and we already have a cached club id/slug from a previous visit,
   * jump straight there while the DB fetch happens in the background.
   * If nothing cached, go to /clubs (no more hardcoded "/clubs/1").
   */
  useEffect(() => {
    if (loading) return;

    if (user?.id) {
      const cached = localStorage.getItem("myClubId");
      if (cached && cached !== "undefined" && cached !== "null") {
        if (!didFastRedirect) {
          setDidFastRedirect(true);
          navigate(`/clubs/${cached}`, { replace: true });
        }
      } else {
        // No cached club yet → just show Clubs list
        if (!didFastRedirect) {
          setDidFastRedirect(true);
          navigate(`/clubs`, { replace: true });
        }
      }
    }
  }, [loading, user?.id, didFastRedirect, navigate]);

  /**
   * Load memberships from Supabase. When successful:
   *  - cache the first club as slug||id (we fetch slug from 'clubs')
   *  - if we didn't already fast-redirect, navigate to the pretty URL now
   */
  useEffect(() => {
    let cancelled = false;

    const loadMemberships = async () => {
      if (loading || !user?.id) return; // don't start if not ready/signed out
      setFetching(true);

      try {
        const { data, error } = await supabase
          .from("club_members")
          .select("club_id")
          .eq("user_id", user.id);

        if (cancelled) return;

        if (error) {
          console.warn("[MyClub] memberships error:", error.message);
          setClubIds([]);
        } else {
          const ids = (data || []).map((r) => r.club_id);
          setClubIds(ids);

          // Resolve a pretty target (slug || id) for the FIRST club, if any
          if (ids.length > 0) {
            const firstId = String(ids[0]);

            // Try to fetch slug for nicer URL (works if 'clubs' has a slug column)
            let target = firstId;
            try {
              const { data: clubRow, error: cErr } = await supabase
                .from("clubs")
                .select("id, slug")
                .eq("id", firstId)
                .limit(1)
                .single();

              if (!cErr && clubRow) {
                target = clubRow.slug || clubRow.id;
              }
            } catch {
              // ignore — we’ll just use id as fallback
            }

            // Cache for instant future redirects
            localStorage.setItem("myClubId", String(target));

            // If we didn’t already fast-redirect earlier, go now
            if (!didFastRedirect && !didVerifiedRedirect) {
              setDidVerifiedRedirect(true);
              navigate(`/clubs/${target}`, { replace: true });
            }
          } else {
            localStorage.removeItem("myClubId");
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.warn("[MyClub] memberships exception:", e?.message);
          setClubIds([]);
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    };

    loadMemberships();

    return () => {
      cancelled = true;
    };
  }, [loading, user?.id, didFastRedirect, didVerifiedRedirect, navigate]);

  // Failsafe: if we're fetching for too long, stop showing spinner
  useEffect(() => {
    if (!fetching) return;
    const t = setTimeout(() => setTimeoutHit(true), 5000);
    return () => clearTimeout(t);
  }, [fetching]);

  /* ----------- RENDER LOGIC ----------- */

  // 1) Signed out (and auth finished) → show sign-in/create card
  if (!loading && !user?.id) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-yellow-400 mb-4 text-center">🎬 Your Film Club</h1>
        <p className="text-center text-zinc-400 mb-10">
          Sign in to see your club, manage screenings, and connect with members.
        </p>
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-lg p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">Welcome to SuperFilm</h2>
          <p className="text-zinc-400 mb-6">Create an account or sign in to get started.</p>
          <div className="flex justify-center gap-3">
            <a href="/auth" className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-3 px-6 rounded-full">
              Create account
            </a>
            <a href="/auth" className="border border-zinc-700 hover:bg-zinc-800 text-white font-semibold py-3 px-6 rounded-full">
              Sign in
            </a>
          </div>
        </div>

        <p className="text-xs text-zinc-600 mt-4 text-center">
          State: signed out • loading={String(loading)}
        </p>
      </div>
    );
  }

  // 2) Auth still resolving OR memberships fetching (and we haven't hit the failsafe)
  if (loading || (fetching && !timeoutHit)) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <div className="w-full max-w-xl p-6 rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-300">
          Loading your club…
        </div>
      </div>
    );
  }

  // 3) Signed in, no clubs (or fetch failed) → empty state with CTAs
  if (user?.id && clubIds.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-yellow-400 mb-4 text-center">🎬 Your Film Club</h1>
        <p className="text-center text-zinc-400 mb-10">
          You haven’t joined a film club yet. Ready to find your people?
        </p>

        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-lg p-8 text-center mb-8">
          <h2 className="text-2xl font-semibold mb-4">Start Your Cinematic Journey</h2>
          <p className="text-zinc-400 mb-6">Explore existing clubs and discover your cinematic tribe.</p>
          <button
            onClick={() => navigate("/clubs")}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-3 px-6 rounded-full w-64 mx-auto"
          >
            Browse Film Clubs
          </button>
        </div>

        <div className="text-center text-zinc-500 font-medium mb-8">or</div>

        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-lg p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">Launch Your Own Club</h2>
          <p className="text-zinc-400 mb-6">
            Want to lead the conversation? Start your own club and invite fellow film lovers.
          </p>
          <button
            onClick={() => navigate("/create-club")}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-3 px-6 rounded-full w-64 mx-auto"
          >
            🎬 Create a Film Club
          </button>
        </div>

        <p className="text-xs text-zinc-600 mt-4 text-center">
          State: signed in • clubs=0 • fetching={String(fetching)} • timeoutHit={String(timeoutHit)}
        </p>
      </div>
    );
  }

  // 4) If we have clubs, the verified redirect effect above will fire; render nothing
  return null;
}





