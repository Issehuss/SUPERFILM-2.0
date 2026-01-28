// src/pages/ManageInvites.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import supabase from "lib/supabaseClient";
import { useUser } from "../context/UserContext";

function randCode(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function ManageInvites() {
  const { user, profile } = useUser();
  const { clubParam } = useParams();

  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState(null); // { id, name, slug }
  const [clubId, setClubId] = useState(null);
  const [role, setRole] = useState(null);
  const [err, setErr] = useState("");

  const [invites, setInvites] = useState([]);
  const [creating, setCreating] = useState(false);

  const [days, setDays] = useState(7);
  const [maxUses, setMaxUses] = useState(25);
  const [note, setNote] = useState("");

  const isPremium = useMemo(
    () => profile?.plan === "directors_cut" || profile?.is_premium === true,
    [profile?.plan, profile?.is_premium]
  );

  const canManage = isPremium && role === "president";

  useEffect(() => {
    let alive = true;
    let retryTimer;
    async function load() {
      if (!clubParam) return;
      const { data: auth } = await supabase.auth.getSession();
      const sessionUserId = auth?.session?.user?.id || null;
      const resolvedUserId = user?.id || sessionUserId;
      if (!resolvedUserId) {
        if (alive) retryTimer = setTimeout(load, 500);
        return;
      }
      setLoading(true);
      setErr("");

      try {
        // Resolve club id
        let resolvedId = null;
        if (/^[0-9a-f-]{16,}$/i.test(clubParam)) {
          resolvedId = clubParam;
        } else {
          const { data: cBySlug, error: eSlug } = await supabase
            .from("clubs")
            .select("id, name, slug")
            .eq("slug", clubParam)
            .maybeSingle();
          if (eSlug) throw eSlug;
          resolvedId = cBySlug?.id ?? null;
          if (alive) setClub(cBySlug || null);
        }
        if (!resolvedId) throw new Error("Club not found.");

        // Role
        const { data: mem, error: eMem } = await supabase
          .from("club_members")
          .select("club_id, user_id, role, joined_at, accepted")
          .eq("club_id", resolvedId)
          .eq("user_id", resolvedUserId)
          .maybeSingle();
        if (eMem) throw eMem;

        // Invites
        const { data: inv, error: eInv } = await supabase
          .from("club_invites")
          .select("id, code, created_by, created_at, expires_at, max_uses, used_count, is_revoked, note")
          .eq("club_id", resolvedId)
          .order("created_at", { ascending: false });
        if (eInv) throw eInv;

        if (!alive) return;
        setClubId(resolvedId);
        setRole(mem?.role || null);
        setInvites(Array.isArray(inv) ? inv : []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load invites.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [clubParam, user?.id]);

  async function createInvite() {
    if (!canManage || !clubId) return;
    setCreating(true);
    setErr("");
    try {
      const code = randCode(10);
      const exp = new Date();
      exp.setDate(exp.getDate() + Math.max(1, Number(days) || 1));

      const payload = {
        club_id: clubId,
        code,
        created_by: user.id,
        expires_at: exp.toISOString(),
        max_uses: Math.max(1, Number(maxUses) || 1),
        note: note || null,
        is_revoked: false,
        used_count: 0,
      };

      const { data, error } = await supabase
        .from("club_invites")
        .insert(payload)
        .select("id, code, created_by, created_at, expires_at, max_uses, used_count, is_revoked, note")
        .single();
      if (error) throw error;

      setInvites((v) => [data, ...v]);
      setNote("");
    } catch (e) {
      setErr(e?.message || "Couldn’t create invite.");
    } finally {
      setCreating(false);
    }
  }

  async function revokeInvite(id) {
    setErr("");
    try {
      const { error } = await supabase
        .from("club_invites")
        .update({ is_revoked: true })
        .eq("id", id)
        .eq("club_id", clubId);
      if (error) throw error;
      setInvites((v) => v.map((i) => (i.id === id ? { ...i, is_revoked: true } : i)));
    } catch (e) {
      setErr(e?.message || "Couldn’t revoke invite.");
    }
  }

  const joinBase =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/`
      : "/join/";

  /* --------------- UI --------------- */

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-3">Manage Invites</h1>
        <div className="text-sm text-zinc-400">Loading…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-3">Manage Invites</h1>
        <div className="text-sm text-red-400">{err}</div>
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-3">Manage Invites</h1>
        <div className="text-sm text-zinc-400">Invites are a Director’s Cut feature.</div>
      </div>
    );
  }
  if (role !== "president") {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold mb-3">Manage Invites</h1>
        <div className="text-sm text-zinc-400">Only the club president can manage invites.</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Manage Invites</h1>

      {/* Create */}
      <section className="rounded-xl border border-zinc-700 bg-black/40 p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Create invite</h2>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Expires in (days)</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-md border border-zinc-700 bg-black/40 p-2 text-sm text-white"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Max uses</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-md border border-zinc-700 bg-black/40 p-2 text-sm text-white"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Note (optional)</label>
            <input
              className="w-full rounded-md border border-zinc-700 bg-black/40 p-2 text-sm text-white"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., For festival panelists"
            />
          </div>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={createInvite}
            disabled={creating}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
              creating
                ? "bg-yellow-500/70 text-black cursor-wait"
                : "bg-yellow-500 text-black hover:bg-yellow-400"
            }`}
          >
            {creating ? "Creating…" : "Create invite"}
          </button>
        </div>
      </section>

      {/* List */}
      <section className="rounded-xl border border-zinc-700 bg-black/40 p-4">
        <h2 className="text-lg font-semibold mb-3">Active invites</h2>

        {invites.length === 0 ? (
          <div className="text-sm text-zinc-400">No invites yet.</div>
        ) : (
          <div className="space-y-3">
            {invites.map((i) => {
              const expired = i.expires_at ? new Date(i.expires_at) < new Date() : false;
              const disabled = i.is_revoked || expired || (i.max_uses && i.used_count >= i.max_uses);
              const joinUrl = `${joinBase}${i.code}`;
              return (
                <div key={i.id} className="rounded-lg border border-zinc-700 p-3 bg-black/30">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white break-all">{joinUrl}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        Uses: {i.used_count ?? 0}
                        {typeof i.max_uses === "number" ? ` / ${i.max_uses}` : ""} •{" "}
                        Expires: {i.expires_at ? new Date(i.expires_at).toLocaleString() : "never"}
                        {i.note ? ` • ${i.note}` : ""}
                      </div>
                      {i.is_revoked && <div className="text-xs text-red-400 mt-1">Revoked</div>}
                      {expired && !i.is_revoked && <div className="text-xs text-zinc-400 mt-1">Expired</div>}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(joinUrl)}
                        className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-white hover:bg-zinc-900"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => revokeInvite(i.id)}
                        disabled={disabled}
                        className={`rounded-md px-2 py-1 text-xs font-medium ${
                          disabled
                            ? "border border-zinc-700 text-zinc-500 cursor-not-allowed"
                            : "border border-red-700 text-red-200 hover:bg-red-900/20"
                        }`}
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
