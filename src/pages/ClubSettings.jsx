// src/pages/ClubSettings.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";

export default function ClubSettings() {
  const { clubParam } = useParams();
  const { user, profile } = useUser();

  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState(null); // { id, name, slug, is_private, wants_private }
  const [clubId, setClubId] = useState(null);
  const [role, setRole] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [members, setMembers] = useState([]);
  const [applyingVP, setApplyingVP] = useState(false);
  const [applyMsg, setApplyMsg] = useState("");
  const [applySent, setApplySent] = useState(false);

  const isPremium = useMemo(
    () => profile?.plan === "directors_cut" || profile?.is_premium === true,
    [profile?.plan, profile?.is_premium]
  );

  const canManage = role === "president"; // checkbox visible for president
  const presidentHasPremium = isPremium; // used to determine final enforcement

  /* ------------------------ LOAD DATA ------------------------ */

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!clubParam || !user?.id) return;
      setLoading(true);
      setErr("");

      try {
        // resolve club ID
        let resolvedId = null;
        if (/^[0-9a-f-]{16,}$/i.test(clubParam)) {
          resolvedId = clubParam;
        } else {
          const { data: cBySlug, error: eSlug } = await supabase
            .from("clubs")
            .select("id")
            .eq("slug", clubParam)
            .maybeSingle();
          if (eSlug) throw eSlug;
          resolvedId = cBySlug?.id ?? null;
        }
        if (!resolvedId) throw new Error("Club not found.");

        // Fetch core data in parallel
        const [clubRes, roleRes, membersRes] = await Promise.all([
          supabase
            .from("clubs")
            .select("id, name, slug, is_private, wants_private")
            .eq("id", resolvedId)
            .maybeSingle(),
          supabase
            .from("club_members")
            .select("role")
            .eq("club_id", resolvedId)
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("club_members")
            .select("user_id, role")
            .eq("club_id", resolvedId),
        ]);

        if (clubRes.error) throw clubRes.error;
        if (roleRes.error) throw roleRes.error;
        if (membersRes.error) throw membersRes.error;

        const clubRow = clubRes.data || null;
        const mem = roleRes.data || null;

        let enrichedMembers = membersRes.data || [];
        if (enrichedMembers.length) {
          const ids = enrichedMembers.map((m) => m.user_id).filter(Boolean);
          const { data: profileRows, error: eProf } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url, slug")
            .in("id", ids);
          if (eProf) throw eProf;
          const pMap = new Map((profileRows || []).map((p) => [p.id, p]));
          enrichedMembers = enrichedMembers.map((m) => ({
            ...m,
            profiles: pMap.get(m.user_id) || null,
          }));
        }

        if (!alive) return;
        setClub(clubRow || null);
        setClubId(resolvedId);
        setRole(mem?.role ?? null);
        setMembers(enrichedMembers);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load settings.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [clubParam, user?.id]);

  /* ----------------------- TOGGLE LOGIC ----------------------- */

  async function togglePrivate(nextWantsPrivate) {
    if (!canManage || !clubId) return;
  
    setSaving(true);
    setErr("");
  
    try {
      const { data, error } = await supabase
        .from("clubs")
        .update({ wants_private: !!nextWantsPrivate })
        .eq("id", clubId)
        .select("id, is_private, wants_private")
        .maybeSingle();
  
      if (error) throw error;
  
      setClub((c) =>
        c
          ? {
              ...c,
              wants_private: data?.wants_private ?? !!nextWantsPrivate,
              is_private: data?.is_private ?? c.is_private,
            }
          : c
      );
    } catch (e) {
      setErr(e?.message || "Couldn’t update privacy.");
    } finally {
      setSaving(false);
    }
  }


  
  async function forcePrivacySync() {
    if (!clubId) return;
    setSaving(true);
    setErr("");
  
    try {
      const { data, error } = await supabase.rpc(
        "sync_club_privacy_for_club",
        { p_club: clubId }
      );
  
      if (error) throw error;
  
      // Re-fetch the club's privacy state
      const { data: refreshed, error: e2 } = await supabase
        .from("clubs")
        .select("id, is_private, wants_private")
        .eq("id", clubId)
        .maybeSingle();
  
      if (e2) throw e2;
  
      setClub((c) =>
        c
          ? {
              ...c,
              is_private: refreshed?.is_private ?? c.is_private,
              wants_private: refreshed?.wants_private ?? c.wants_private,
            }
          : c
      );
    } catch (e) {
      setErr(e?.message || "Failed to sync privacy.");
    } finally {
      setSaving(false);
    }
  }
  

  /* ---------------------------- UI STATES ---------------------------- */

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-3">Club Settings</h1>
        <p className="text-sm text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-3">Club Settings</h1>
        <p className="text-sm text-red-400">{err}</p>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-3">Club Settings</h1>
        <p className="text-sm text-zinc-400">Club not found.</p>
      </div>
    );
  }

  // Premium gate
  if (!presidentHasPremium && role === "president") {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-3">Club Settings</h1>

        <div className="rounded-xl border border-zinc-700 p-4 bg-black/40">
          <p className="text-sm text-zinc-300 mb-2">
            Private clubs are a{" "}
            <span className="font-semibold text-[rgb(var(--brand-yellow))]">
              Director’s Cut
            </span>{" "}
            feature.
          </p>

          {club.wants_private && (
            <p className="text-sm text-red-400 mb-2">
              Your club wants to be private, but you need Director’s Cut for
              privacy to activate.
            </p>
          )}

          <Link
            to="/premium"
            className="inline-block mt-3 rounded-lg bg-yellow-500 text-black px-3 py-1.5 text-sm font-semibold hover:bg-yellow-400"
          >
            Upgrade to Director’s Cut
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------------------- MAIN RENDER ---------------------------- */

  const privacyStatus = (() => {
    if (club.is_private) return "Private (active)";
    if (club.wants_private && !club.is_private)
      return "Private (disabled — premium required)";
    return "Public";
  })();

  const privacyColor =
    privacyStatus === "Private (active)"
      ? "text-green-400"
      : privacyStatus.includes("disabled")
      ? "text-red-400"
      : "text-zinc-300";

      const privacyBadgeClass =
  privacyStatus === "Private (active)"
    ? "bg-emerald-500/10 border-emerald-400/70 text-emerald-300"
    : privacyStatus.includes("disabled")
    ? "bg-red-500/10 border-red-400/70 text-red-300"
    : "bg-zinc-800/60 border-zinc-500/60 text-zinc-200";


  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Club Settings</h1>

      {/* --- Privacy Section --- */}
      <section className="rounded-xl border border-zinc-700 bg-black/40 p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Privacy</h2>
        <p className="text-sm text-zinc-400 mb-3">
          Private clubs do not appear on the discovery page and can only be
          joined through invites.
        </p>

        {/* Status display */}
        <div className="mb-3">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-wide ${privacyBadgeClass}`}
          >
            {privacyStatus}
          </span>
        </div>

        {role === "president" ? (
          <>
            {/* Toggle */}
            <div className="flex items-center gap-4 mt-4">
              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => togglePrivate(!club.wants_private)}
                disabled={saving}
                className={`sf-toggle ${club.wants_private ? "sf-toggle-on" : ""} ${
                  saving ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <div className="sf-toggle-handle" />
              </button>

              <button
                onClick={forcePrivacySync}
                className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-zinc-600 bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/60"
                disabled={saving}
              >
                Force Privacy Sync
              </button>

              {/* Label + Explanation */}
              <div>
                <p className="text-sm font-medium text-zinc-200">Enable Private Mode</p>
                <p className="text-xs text-zinc-500">
                  Only available to <span className="text-yellow-400">Director’s Cut</span>{" "}
                  presidents.
                </p>
              </div>
            </div>

            {saving && <p className="mt-2 text-xs text-zinc-400">Saving…</p>}
          </>
        ) : (
          <p className="text-xs text-zinc-500">
            Only the club president can change privacy. Your current role: {role || "Member"}.
          </p>
        )}
      </section>

      {/* --- Invites Section --- */}
      <section className="rounded-xl border border-zinc-700 bg-black/40 p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Invites</h2>
        <p className="text-sm text-zinc-400 mb-3">
          Generate invite links with expiry and usage limits.
        </p>
        {role === "president" ? (
          <Link
            to={`/clubs/${club.slug || club.id}/invites`}
            className="inline-block rounded-lg bg-yellow-400 text-black px-3 py-1.5 text-sm font-semibold hover:bg-yellow-300"
          >
            Manage Invites
          </Link>
        ) : (
          <p className="text-xs text-zinc-500">Only the club president can manage invites.</p>
        )}
      </section>

      {/* --- Roles & Responsibilities --- */}
      <RolesSection
        clubId={clubId}
        clubName={club.name}
        role={role}
        members={members}
        currentUserId={user.id}
        onMembersChange={setMembers}
        applyingVP={applyingVP}
        setApplyingVP={setApplyingVP}
        applyMsg={applyMsg}
        setApplyMsg={setApplyMsg}
        applySent={applySent}
        setApplySent={setApplySent}
      />
    </div>
  );
}

function RolesSection({
  clubId,
  clubName,
  role,
  members,
  currentUserId,
  onMembersChange,
  applyingVP,
  setApplyingVP,
  applyMsg,
  setApplyMsg,
  applySent,
  setApplySent,
}) {
  const [saving, setSaving] = useState(false);

  const sortedMembers = useMemo(() => {
    return [...(members || [])].sort((a, b) => {
      const roleOrder = { president: 0, vice_president: 1, member: 2, editor: 2, admin: 2 };
      const ra = roleOrder[a.role] ?? 3;
      const rb = roleOrder[b.role] ?? 3;
      if (ra !== rb) return ra - rb;
      const an = a.profiles?.display_name || a.profiles?.slug || a.user_id;
      const bn = b.profiles?.display_name || b.profiles?.slug || b.user_id;
      return String(an).localeCompare(String(bn));
    });
  }, [members]);

  async function updateRole(userId, nextRole) {
    if (!clubId) return;
    // Confirmation when handing presidency
    if (nextRole === "president" && userId !== currentUserId) {
      const ok = window.confirm(
        "Make this member a co-president? They will have full control over settings, invites, and events. " +
          "Please align together, stay cordial and communicative, and avoid shifts that could disrupt the club."
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("update_club_member_role", {
        p_club_id: clubId,
        p_target_user_id: userId,
        p_new_role: nextRole,
      });
      if (error) throw error;
      onMembersChange((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, role: nextRole } : m))
      );
      // Notify promoted vice-presidents
      if (nextRole === "vice_president") {
        await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            type: "role.promoted",
            actor_id: currentUserId,
            club_id: clubId,
            data: {
              role: "Vice President",
              club_name: clubName,
              duties:
                "Support the president: organise screenings, communicate updates, handle invites, and coordinate events.",
            },
          })
          .throwOnError();
      }
      if (nextRole === "president") {
        await supabase
          .from("notifications")
          .insert({
            user_id: userId,
            type: "role.promoted",
            actor_id: currentUserId,
            club_id: clubId,
            data: {
              role: "President",
              club_name: clubName,
              duties:
                "Lead the club: schedule screenings, communicate updates, manage invites, and set the vision.",
            },
          })
          .throwOnError();
      }
      toast.success("Role updated");
    } catch (e) {
      toast.error(e?.message || "Failed to update role.");
    } finally {
      setSaving(false);
    }
  }

  async function applyForVP() {
    if (!clubId || applyingVP) return;
    setApplyingVP(true);
    try {
      // notify all presidents
      const presidents = (members || []).filter((m) => m.role === "president");
      const payload = presidents.map((p) => ({
        user_id: p.user_id,
        type: "role.application",
        actor_id: currentUserId,
        club_id: clubId,
        data: {
          role: "Vice President",
          message: applyMsg || "",
          club_name: clubName,
        },
      }));
      if (payload.length) {
        await supabase.from("notifications").insert(payload);
      }
      setApplySent(true);
      setApplyMsg("");
    } catch (e) {
      alert(e?.message || "Could not send application.");
    } finally {
      setApplyingVP(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-700 bg-black/40 p-4">
      <h2 className="text-lg font-semibold mb-2">Roles &amp; Responsibilities</h2>
      <p className="text-sm text-zinc-400 mb-3">
        Vice Presidents help organise screenings, communicate updates, and keep the club running
        smoothly. Presidents can assign roles below.
      </p>

      {role === "president" ? (
        <div className="space-y-3">
          {sortedMembers.map((m) => {
            const name = m.profiles?.display_name || m.profiles?.slug || m.user_id;
            const roleLabel =
              m.role === "president"
                ? "President / Member"
                : m.role === "vice_president"
                ? "VP / Member"
                : "Member";
            return (
              <div
                key={m.user_id}
                className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 bg-zinc-900/40"
              >
                <div>
                  <div className="text-sm text-white">{name}</div>
                  <div className="text-xs text-zinc-500">Role: {roleLabel}</div>
                </div>
                <div className="relative">
                  <select
                    className="appearance-none rounded-lg bg-black/60 border border-yellow-400/40 text-sm px-3 py-2 pr-9 text-white shadow-[0_6px_18px_rgba(0,0,0,0.45)] focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/30 focus:outline-none transition"
                    value={m.role || "member"}
                    disabled={saving || m.user_id === currentUserId}
                    onChange={(e) => updateRole(m.user_id, e.target.value)}
                  >
                    <option value="member">Member</option>
                    <option value="vice_president">VP / Member</option>
                    <option value="president">President / Member</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-yellow-300">
                    ▾
                  </span>
                </div>
              </div>
            );
          })}
          {saving && <p className="text-xs text-zinc-400">Saving…</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-white/10 px-3 py-2 bg-zinc-900/40">
            <div className="text-sm text-white">
              Your role:{" "}
              {role === "president"
                ? "President / Member"
                : role === "vice_president"
                ? "VP / Member"
                : "Member"}
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Vice Presidents help the president organise screenings, manage invites, and share updates.
            </p>
          </div>

          <div className="rounded-lg border border-white/10 px-3 py-3 bg-zinc-900/40">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white">Apply for Vice President</div>
                <p className="text-xs text-zinc-500">
                  Tell your president why you’d be a good fit.
                </p>
              </div>
            </div>
            <textarea
              className="mt-2 w-full rounded-lg bg-black/50 border border-zinc-700 text-sm p-2 text-white"
              rows={3}
              placeholder="Optional: share your plans or availability…"
              value={applyMsg}
              onChange={(e) => setApplyMsg(e.target.value)}
              disabled={applySent}
            />
            <button
              type="button"
              onClick={applyForVP}
              disabled={applyingVP || applySent}
              className="mt-2 inline-flex items-center gap-2 rounded-lg bg-yellow-500 text-black px-3 py-1.5 text-sm font-semibold hover:bg-yellow-400 disabled:opacity-60"
            >
              {applySent ? "Application sent" : applyingVP ? "Sending…" : "Send application"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
