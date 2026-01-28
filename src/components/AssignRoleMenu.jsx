// src/components/AssignRoleMenu.jsx
import { useState, useMemo } from "react";
import supabase from "lib/supabaseClient";

const ALL_ROLES = [
  { value: "member", label: "Member" },
  { value: "editor", label: "Editor" },
  { value: "vice_president", label: "Vice President" },
  { value: "president", label: "President" }, // keep but you may want to hide for safety
];

export default function AssignRoleMenu({
  clubId,
  targetUserId,
  currentRole,
  isPresident,             // boolean for the *viewer* (caller)
  disableSelfChange = true, // usually true: presidents can’t change themselves
  myUserId,
  onChanged,               // callback(newRole)
}) {
  const [role, setRole] = useState(currentRole || "member");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const canEdit = useMemo(() => {
    if (!isPresident) return false;
    if (disableSelfChange && myUserId && myUserId === targetUserId) return false;
    return true;
  }, [isPresident, disableSelfChange, myUserId, targetUserId]);

  async function handleChange(e) {
    const newRole = e.target.value;
    setRole(newRole);
    setError("");

    if (!canEdit) return;

    setSaving(true);
    const { error } = await supabase
      .from("club_members")
      .update({ role: newRole })
      .eq("club_id", clubId)
      .eq("user_id", targetUserId);

    setSaving(false);

    if (error) {
      // revert UI on error
      setRole(currentRole);
      setError(error.message || "Failed to update role.");
      return;
    }

    if (onChanged) onChanged(newRole);
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className={`rounded-md border bg-black/50 text-sm px-2 py-1
          ${canEdit ? "border-zinc-700 hover:border-zinc-500" : "border-zinc-800 opacity-60"}
        `}
        value={role}
        onChange={handleChange}
        disabled={!canEdit || saving}
        title={canEdit ? "Change role" : "Only the President can change roles"}
      >
        {ALL_ROLES.map(r => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      {saving && <span className="text-xs text-zinc-400">Saving…</span>}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
