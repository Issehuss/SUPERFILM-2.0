import { useState } from "react";

export default function EditRoleAcceptance({ clubId, useRolesHook }) {
  const { myRole, hasSigned, sign, loading } = useRolesHook(clubId);
  const [busy, setBusy] = useState(false);

  if (!clubId || myRole === "member") return null;

  return (
    <div className="rounded-xl border border-zinc-800 p-4 mt-4">
      <p className="text-sm text-zinc-300">
        You’ve been assigned: <b className="text-zinc-100">{myRole.replaceAll("_", " ")}</b>
      </p>
      {hasSigned ? (
        <p className="mt-2 text-xs text-emerald-400">Role agreement signed ✔</p>
      ) : (
        <button
          type="button"
          disabled={busy || loading}
          onClick={async () => {
            setBusy(true);
            try { await sign(); } finally { setBusy(false); }
          }}
          className="mt-3 rounded-xl border border-yellow-500 bg-yellow-500/10 px-3 py-2 text-sm hover:bg-yellow-500/20"
        >
          Sign & Accept Role
        </button>
      )}
    </div>
  );
}
