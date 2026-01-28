// src/pages/LeaveClub.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import supabase from "lib/supabaseClient";
import { useUser, useMembershipRefresh } from "../context/UserContext";
import { markClubLeft } from "../lib/membershipCooldown";
import Splash from "../components/Splash";

const UUID_RX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function LeaveClub() {
  const { clubParam } = useParams();
  const { user } = useUser();
  const { bumpMembership } = useMembershipRefresh();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState(null); // { id, name, slug, banner_image/banner_url }
  const [membership, setMembership] = useState(null); // { role }
  const [successors, setSuccessors] = useState([]); // [{ id, name }]
  const [selectedSuccessor, setSelectedSuccessor] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // redirect if not signed in
  useEffect(() => {
    let cancelled = false;
    let retryTimer;
    let attempts = 0;

    const check = async () => {
      const { data: auth } = await supabase.auth.getSession();
      const sessionUserId = auth?.session?.user?.id || null;
      const resolvedUserId = user?.id || sessionUserId;
      if (!resolvedUserId) {
        attempts += 1;
        if (!cancelled && attempts >= 6) {
          navigate("/auth", { replace: true });
          return;
        }
        retryTimer = setTimeout(check, 500);
      }
    };

    check();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [user?.id, navigate]);

  const isPresident = membership?.role === "president";
  const hasSuccessors = successors.length > 0;

  // Load club + role + possible successors
  useEffect(() => {
    let cancelled = false;
    let retryTimer;

    async function run() {
      if (!clubParam) {
        setLoading(false);
        return;
      }
      const { data: auth } = await supabase.auth.getSession();
      const sessionUserId = auth?.session?.user?.id || null;
      const resolvedUserId = user?.id || sessionUserId;
      if (!resolvedUserId) {
        if (!cancelled) {
          setLoading(true);
          retryTimer = setTimeout(run, 500);
        }
        return;
      }

      setLoading(true);
      setError("");

      try {
        // 1) Find club by slug or id
        let clubRow = null;

        const { data: bySlug, error: slugErr } = await supabase
  .from("clubs")
  .select("id, name, slug, banner_url")
  .eq("slug", clubParam)
  .maybeSingle();


        if (slugErr) throw slugErr;
        if (bySlug) {
          clubRow = bySlug;
        } else if (UUID_RX.test(String(clubParam))) {
          const { data: byId, error: idErr } = await supabase
            .from("clubs")
            .select("id, name, slug, banner_url")
            .eq("id", clubParam)
            .maybeSingle();
          if (idErr) throw idErr;
          clubRow = byId;
        }

        if (!clubRow) {
          if (!cancelled) {
            setError("We couldn't find this club.");
            setLoading(false);
          }
          return;
        }

        if (cancelled) return;

        setClub(clubRow);

        // 2) Load membership/role for current user
        const { data: mem, error: memErr } = await supabase
          .from("club_members")
          .select("club_id, user_id, role, joined_at, accepted")
          .eq("club_id", clubRow.id)
          .eq("user_id", resolvedUserId)
          .maybeSingle();

        if (memErr) throw memErr;

        if (!mem) {
          if (!cancelled) {
            setError("You are not a member of this club.");
            setMembership(null);
            setLoading(false);
          }
          return;
        }

        if (cancelled) return;

        setMembership(mem);

        // 3) If president, load potential successors
        if (mem.role === "president") {
          // Load all other members
          const { data: others, error: othersErr } = await supabase
            .from("club_members")
            .select("club_id, user_id, role, joined_at, accepted")
            .eq("club_id", clubRow.id)
            .neq("user_id", user.id);

          if (othersErr) throw othersErr;

          const otherIds = (others || []).map((r) => r.user_id);
          let profilesMap = {};

          if (otherIds.length) {
            const { data: profs, error: profErr } = await supabase
              .from("profiles")
              .select("id, display_name, slug")
              .in("id", otherIds);

            if (profErr) throw profErr;

            profilesMap = (profs || []).reduce((acc, p) => {
              acc[p.id] = p;
              return acc;
            }, {});
          }

          // "Admin / staff" = anyone with a non-null role that is not plain "member"
          const candidates = (others || [])
            .filter((row) => {
              const role = String(row.role || "").toLowerCase();
              if (!role) return false;
              if (role === "member") return false;
              return true;
            })
            .map((row) => {
              const prof = profilesMap[row.user_id];
              return {
                id: row.user_id,
                role: row.role,
                name:
                  prof?.display_name ||
                  prof?.slug ||
                  `Member (${String(row.user_id).slice(0, 6)}…)`,
              };
            });

          if (!cancelled) {
            setSuccessors(candidates);
            setSelectedSuccessor(candidates[0]?.id ?? null);
          }
        }

        if (!cancelled) setLoading(false);
      } catch (e) {
        console.error("[LeaveClub] load error:", e);
        if (!cancelled) {
          setError("Something went wrong while loading this club.");
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [user?.id, clubParam]);

  const explanationLines = useMemo(
    () => [
      "You will leave the club chat.",
      "You will stop receiving notifications from this club.",
      "You will lose access to upcoming club-only events and screenings.",
      "Any special staff or safety roles you have here will be removed.",
    ],
    []
  );

  async function handleConfirmLeave() {
    if (!club || !membership || !user?.id) return;
    setSaving(true);
    setError("");

    try {
      if (isPresident) {
        if (!hasSuccessors) {
          setError(
            "You are the only president. Please promote another admin before leaving."
          );
          setSaving(false);
          return;
        }
        if (!selectedSuccessor) {
          setError("Please choose who should become the new president.");
          setSaving(false);
          return;
        }

        // 1) Transfer presidency
        const { error: upErr } = await supabase
          .from("club_members")
          .update({ role: "president" })
          .eq("club_id", club.id)
          .eq("user_id", selectedSuccessor);

        if (upErr) throw upErr;
      }

      // 2) Remove current user from members
      const { error: delErr } = await supabase
        .from("club_members")
        .delete()
        .eq("club_id", club.id)
        .eq("user_id", user.id);

      if (delErr) throw delErr;

      markClubLeft(club.id);
      bumpMembership();

      // 3) Redirect out of the club
      navigate("/clubs", { replace: true });
    } catch (e) {
      console.error("[LeaveClub] confirm error:", e);
      setError("We couldn't complete that. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!user) return <Splash message="Loading your account…" />;

  if (loading) return <Splash message="Loading club…" />;

  if (!club) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-white">
        <h1 className="text-xl font-semibold mb-2">Leave club</h1>
        <p className="text-sm text-zinc-400">
          We couldn&apos;t find this club. It might have been deleted or the link is wrong.
        </p>
        <div className="mt-6">
          <Link
            to="/clubs"
            className="inline-flex items-center rounded-full px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700"
          >
            Back to Clubs
          </Link>
        </div>
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-white">
        <h1 className="text-xl font-semibold mb-2">{club.name}</h1>
        <p className="text-sm text-zinc-400">
          You&apos;re not a member of this club, so there&apos;s nothing to leave.
        </p>
        <div className="mt-6">
          <Link
            to={`/clubs/${club.slug || club.id}`}
            className="inline-flex items-center rounded-full px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700"
          >
            Back to club
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 text-white">
      {/* Banner stub */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
        <div className="relative h-32 w-full overflow-hidden">
          {club.banner_image || club.banner_url ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${club.banner_image || club.banner_url})`,
                filter: "blur(4px)",
                transform: "scale(1.05)",
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 to-zinc-800" />
          )}
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 flex h-full items-center px-6">
            <div>
              <div className="text-xs uppercase tracking-wide text-zinc-400">
                Leave club
              </div>
              <div className="text-lg font-semibold">{club.name}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main card */}
      <div className="rounded-2xl border border-zinc-800 bg-black/70 p-6">
        <h2 className="text-lg font-semibold mb-2">
          Are you sure you want to leave this club?
        </h2>
        <p className="text-sm text-zinc-400 mb-4">
          We just want to be clear about what will happen if you leave{" "}
          <span className="font-semibold text-zinc-200">{club.name}</span>.
        </p>

        <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
            What happens when you leave
          </div>
          <ul className="space-y-1 text-sm text-zinc-300">
            {explanationLines.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-[6px] h-[4px] w-[4px] rounded-full bg-yellow-400" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {isPresident && (
          <div className="mb-5 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-yellow-400 mb-2">
              You are the president
            </div>

            {hasSuccessors ? (
              <>
                <p className="text-sm text-zinc-200 mb-3">
                  You are the current president of this club. Before you leave, you must
                  choose who will become the new president. After the transfer, you will
                  be removed from the club.
                </p>
                <label className="block text-xs text-zinc-400 mb-1">
                  Choose the new president
                </label>
                <select
                  value={selectedSuccessor || ""}
                  onChange={(e) => setSelectedSuccessor(e.target.value || null)}
                  className="w-full max-w-sm rounded-lg border border-yellow-500/40 bg-black px-3 py-2 text-sm text-white"
                >
                  {successors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role || "staff"})
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-zinc-400">
                  Presidency will be transferred first. Your membership will then be
                  removed in the same action.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-zinc-200 mb-2">
                  You are the only president in this club right now.
                </p>
                <p className="text-sm text-zinc-400">
                  To keep the club safe, you cannot leave while you are the only
                  president. Add or promote another admin or staff member to president,
                  then come back here if you still want to leave.
                </p>
              </>
            )}
          </div>
        )}

        {!isPresident && membership?.role && membership.role !== "member" && (
          <div className="mb-5 rounded-xl border border-zinc-700 bg-zinc-900/60 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
              You have a staff role
            </div>
            <p className="text-sm text-zinc-300">
              You currently have a special role in this club (
              <span className="font-semibold">{membership.role}</span>). Leaving will
              remove this role from you.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleConfirmLeave}
            disabled={saving || (isPresident && !hasSuccessors)}
            className="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isPresident ? "Transfer presidency and leave" : "Leave club"}
          </button>
          <button
            type="button"
            onClick={() =>
              navigate(`/clubs/${club.slug || club.id}`, { replace: true })
            }
            className="inline-flex items-center rounded-full px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700"
          >
            Cancel
          </button>
          <Link
            to={`/clubs/${club.slug || club.id}/members`}
            className="ml-auto text-xs text-zinc-400 hover:text-zinc-200 underline-offset-4 hover:underline"
          >
            Open members page
          </Link>
        </div>
      </div>
    </div>
  );
}
