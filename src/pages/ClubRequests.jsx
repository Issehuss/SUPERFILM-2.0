import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";
import { Check, X, Users } from "lucide-react";

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ClubRequests() {
  const { clubParam } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();

  const [club, setClub] = useState(null);          // { id, name, slug }
  const [rows, setRows] = useState([]);            // pending requests
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState("");

  // 1) resolve slug-or-id -> club row
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        let c = null;
        if (UUID_RX.test(clubParam)) {
          const { data } = await supabase
            .from("clubs")
            .select("id, name, slug")
            .eq("id", clubParam)
            .maybeSingle();
          c = data || null;
        } else {
          const { data } = await supabase
            .from("clubs")
            .select("id, name, slug")
            .eq("slug", clubParam)
            .maybeSingle();
          c = data || null;
        }
        if (!alive) return;
        if (!c) {
          setErr("Club not found.");
          setClub(null);
          setLoading(false);
          return;
        }
        setClub(c);
      } catch (e) {
        if (alive) { setErr(e.message || "Failed to load club"); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [clubParam]);

 // 2) load pending requests for this club (two queries: requests -> profiles)
useEffect(() => {
    if (!club?.id) return;
    let alive = true;
  
    (async () => {
      setLoading(true);
      setErr("");
      try {
        // A) get pending requests
        const { data: reqs, error: rErr } = await supabase
          .from("membership_requests")
          .select("id, user_id, created_at, status")
          .eq("club_id", club.id)
          .eq("status", "pending")
          .order("created_at", { ascending: true });
  
        if (rErr) throw rErr;
        if (!reqs?.length) {
          if (alive) { setRows([]); setLoading(false); }
          return;
        }
  
        // B) fetch profiles for those user_ids
        const userIds = Array.from(new Set(reqs.map(r => r.user_id)));
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("id, slug, display_name, avatar_url")
          .in("id", userIds);
  
        if (pErr) throw pErr;
  
        // C) attach profile to each request
        const byId = new Map((profs || []).map(p => [p.id, p]));
        const merged = reqs.map(r => ({ ...r, profiles: byId.get(r.user_id) || null }));
  
        if (alive) setRows(merged);
      } catch (e) {
        if (alive) setErr(e.message || "Failed to load requests");
      } finally {
        if (alive) setLoading(false);
      }
    })();
  
    return () => { alive = false; };
  }, [club?.id]);
  

  // 3) approve / reject
  async function approve(r) {
    if (!club?.id || !r?.id) return;
    setBusyId(r.id);
    setErr("");
    try {
      // a) add to club_members (ignore duplicate)
      const { error: insErr } = await supabase
        .from("club_members")
        .insert({ club_id: club.id, user_id: r.user_id, role: "member" });
      if (insErr && insErr.code !== "23505") throw insErr;

      // b) mark request approved
      const { error: updErr } = await supabase
        .from("membership_requests")
        .update({ status: "approved", decided_at: new Date().toISOString() })
        .eq("id", r.id);
      if (updErr) throw updErr;

      // c) notify the requester
      await supabase.from("notifications").insert({
        user_id: r.user_id,
        club_id: club.id,
        type: "club.membership.approved",
        data: {
          club_name: club.name,
          slug: club.slug,
          href: `/clubs/${club.slug || club.id}`,
          message: `Your request to join ${club.name} was approved.`,
        },
      });

      // remove from list
      setRows((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e) {
      setErr(e.message || "Approve failed");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(r) {
    if (!club?.id || !r?.id) return;
    setBusyId(r.id);
    setErr("");
    try {
      const { error: updErr } = await supabase
        .from("membership_requests")
        .update({ status: "rejected", decided_at: new Date().toISOString() })
        .eq("id", r.id);
      if (updErr) throw updErr;

      await supabase.from("notifications").insert({
        user_id: r.user_id,
        club_id: club.id,
        type: "club.membership.rejected",
        data: {
          club_name: club.name,
          slug: club.slug,
          href: `/clubs/${club.slug || club.id}`,
          message: `Your request to join ${club.name} was declined.`,
        },
      });

      setRows((prev) => prev.filter((x) => x.id !== r.id));
    } catch (e) {
      setErr(e.message || "Reject failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 text-white">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-yellow-400" />
          Membership Requests
        </h1>
        {club && (
          <Link
            className="text-sm text-yellow-400 hover:underline"
            to={`/clubs/${club.slug || club.id}`}
          >
            Back to {club.name}
          </Link>
        )}
      </div>

      {err && <div className="mt-3 text-sm text-red-400">{err}</div>}

      {loading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-6 text-sm text-zinc-400">
          No pending requests right now.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => {
            const p = r.profiles || {};
            const name = p.display_name || "Member";
            const avatar = p.avatar_url || "/avatar_placeholder.png";
            const profileHref = p.slug ? `/u/${p.slug}` : `/profile/${p.id}`;

            return (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-xl bg-white/5 ring-1 ring-white/10 p-3"
              >
                <Link to={profileHref} className="shrink-0">
                  <img
                    src={avatar}
                    alt={name}
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-white/10"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/avatar_placeholder.png";
                    }}
                  />
                </Link>

                <div className="flex-1 min-w-0">
                  <Link to={profileHref} className="font-medium hover:underline">
                    {name}
                  </Link>
                  <div className="text-xs text-zinc-500">
                    Requested {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approve(r)}
                    disabled={busyId === r.id}
                    className="inline-flex items-center gap-1 rounded bg-yellow-500 px-3 py-1 text-black text-sm font-semibold hover:bg-yellow-400 disabled:opacity-60"
                  >
                    <Check size={16} /> Approve
                  </button>
                  <button
                    onClick={() => reject(r)}
                    disabled={busyId === r.id}
                    className="inline-flex items-center gap-1 rounded bg-white/10 px-3 py-1 text-sm hover:bg-white/15 disabled:opacity-60"
                  >
                    <X size={16} /> Decline
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
