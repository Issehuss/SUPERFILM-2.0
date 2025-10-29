// src/components/MembershipRequestsPanel.jsx
import supabase from "../supabaseClient";
import { useEffect, useState } from "react";

export default function MembershipRequestsPanel({ clubId }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("membership_requests")
        .select("user_id, status, created_at, id, profiles: user_id (display_name, avatar_url)")
        .eq("club_id", clubId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (mounted) setRows(data || []);
    })();
    return () => { mounted = false; };
  }, [clubId]);

  async function approve(uid) {
    const { error } = await supabase.rpc("approve_membership", {
      p_club_id: clubId,
      p_user_id: uid,
    });
    if (error) return alert(error.message);
    setRows((r) => r.filter((x) => x.user_id !== uid));
  }

  async function reject(uid) {
    const { error } = await supabase.rpc("reject_membership", {
      p_club_id: clubId,
      p_user_id: uid,
    });
    if (error) return alert(error.message);
    setRows((r) => r.filter((x) => x.user_id !== uid));
  }

  if (!rows.length) {
    return <p className="text-sm text-zinc-500">No pending requests.</p>;
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3">
          <img
            src={r.profiles?.avatar_url || "/avatar_placeholder.png"}
            alt=""
            className="h-8 w-8 rounded-full"
          />
          <span className="flex-1 text-sm">
            {r.profiles?.display_name || r.user_id}
          </span>
          <button
            onClick={() => reject(r.user_id)}
            className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
          >
            Reject
          </button>
          <button
            onClick={() => approve(r.user_id)}
            className="text-xs px-2 py-1 rounded bg-yellow-500 text-black hover:bg-yellow-400"
          >
            Approve
          </button>
        </li>
      ))}
    </ul>
  );
}
