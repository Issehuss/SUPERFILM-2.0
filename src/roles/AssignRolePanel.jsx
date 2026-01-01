import { useState } from "react";

const ROLES = [
  { value: "president", label: "President" },
  { value: "vice_president", label: "Vice-President" },
  { value: "member", label: "Remove leadership (Member)" },
];

export default function AssignRolePanel({ clubId, useRolesHook }) {
  const { members, isLeader, assign, loading } = useRolesHook(clubId);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("vice_president");
  const [busy, setBusy] = useState(false);

  if (!isLeader) return null;

  return (
    <div className="rounded-xl border border-zinc-800 p-4 mt-6">
      <h4 className="text-sm font-semibold mb-3">Assign Club Role</h4>

      <div className="grid gap-3 md:grid-cols-3">
        <select
          className="rounded-lg bg-zinc-900 border border-zinc-700 p-2"
          value={userId}
          onChange={e => setUserId(e.target.value)}
        >
          <option value="">Select member…</option>
          {members.map(m => (
            <option key={m.user_id} value={m.user_id}>
              {(m.profiles?.display_name || m.user_id)} — {m.role}
            </option>
          ))}
        </select>

        <select
          className="rounded-lg bg-zinc-900 border border-zinc-700 p-2"
          value={role}
          onChange={e => setRole(e.target.value)}
        >
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        <button
          className="rounded-lg border border-yellow-500 bg-yellow-500/10 px-3 py-2 hover:bg-yellow-500/20"
          disabled={!userId || !role || busy || loading}
          onClick={async () => {
            setBusy(true);
            try { await assign({ userId, role }); } finally { setBusy(false); }
          }}
        >
          Save Role
        </button>
      </div>

      <p className="mt-2 text-xs text-zinc-400">
        Only the President can assign roles. Assignees confirm in Edit Profile.
      </p>
    </div>
  );
}
