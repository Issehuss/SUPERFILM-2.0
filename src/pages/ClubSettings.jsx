// src/pages/ClubSettings.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";

export default function ClubSettings() {
  const { clubParam } = useParams();
  const { user, profile } = useUser();

  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState(null); // { id, name, slug, is_private }
  const [clubId, setClubId] = useState(null);
  const [role, setRole] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const isPremium = useMemo(
    () => profile?.plan === "directors_cut" || profile?.is_premium === true,
    [profile?.plan, profile?.is_premium]
  );

  const canManage = isPremium && role === "president";

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!clubParam || !user?.id) return;

      setLoading(true);
      setErr("");

      try {
        // Resolve club by slug OR id
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

        // Load basic club info
        const { data: clubRow, error: eClub } = await supabase
          .from("clubs")
          .select("id, name, slug, is_private")
          .eq("id", resolvedId)
          .maybeSingle();
        if (eClub) throw eClub;

        // Load my role
        const { data: mem, error: eMem } = await supabase
          .from("club_members")
          .select("role")
          .eq("club_id", resolvedId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (eMem) throw eMem;

        if (!alive) return;
        setClubId(resolvedId);
        setClub(clubRow || null);
        setRole(mem?.role || null);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load settings.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [clubParam, user?.id]);

  async function togglePrivate(next) {
    if (!canManage || !clubId) return;
    setSaving(true);
    setErr("");
    try {
      const { error } = await supabase
        .from("clubs")
        .update({ is_private: !!next })
        .eq("id", clubId);
      if (error) throw error;
      setClub((c) => (c ? { ...c, is_private: !!next } : c));
    } catch (e) {
      setErr(e?.message || "Couldn’t update privacy.");
    } finally {
      setSaving(false);
    }
  }

  /* --------------- UI --------------- */

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-3">Club Settings</h1>
        <div className="text-sm text-zinc-400">Loading…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-3">Club Settings</h1>
        <div className="text-sm text-red-400">{err}</div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-3">Club Settings</h1>
        <div className="text-sm text-zinc-400">Club not found.</div>
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-3">Club Settings</h1>
        <div className="rounded-xl border border-zinc-700 p-4 bg-black/40">
          <p className="text-sm text-zinc-300">
            Private clubs are a <span className="font-semibold">Director’s Cut</span> feature.
          </p>
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

  if (role !== "president") {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-3">Club Settings</h1>
        <div className="text-sm text-zinc-400">
          Only the club president can manage privacy and invites.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Club Settings</h1>

      {/* Privacy */}
      <section className="rounded-xl border border-zinc-700 bg-black/40 p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Privacy</h2>
        <p className="text-sm text-zinc-400 mb-3">
          Keep your club off the public discovery page. Members can join by invitation only.
        </p>

        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!club.is_private}
            onChange={(e) => togglePrivate(e.target.checked)}
            disabled={saving}
          />
          <span className="text-sm">Make this club private (invite only)</span>
        </label>

        {saving && <div className="mt-2 text-xs text-zinc-400">Saving…</div>}
      </section>

      {/* Invites */}
      <section className="rounded-xl border border-zinc-700 bg-black/40 p-4">
        <h2 className="text-lg font-semibold mb-2">Invites</h2>
        <p className="text-sm text-zinc-400 mb-3">
          Generate invite links with expiry and usage limits.
        </p>
        <Link
          to={`/clubs/${club.slug || club.id}/invites`}
          className="inline-block rounded-lg bg-zinc-200 text-black px-3 py-1.5 text-sm font-semibold hover:bg-white"
        >
          Manage Invites
        </Link>
      </section>
    </div>
  );
}
