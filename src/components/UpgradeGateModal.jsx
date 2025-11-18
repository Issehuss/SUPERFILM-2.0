import { X } from "lucide-react";
import { Link } from "react-router-dom";

export default function UpgradeGateModal({ open, onClose, limit = 1, premiumLimit = 5 }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Upgrade to create more clubs</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-white/5">
            <X className="h-5 w-5 text-zinc-400" />
          </button>
        </div>
        <p className="mb-4 text-sm text-zinc-300">
          You’ve reached your club limit (<span className="font-mono">{limit}</span> on Free).
          Upgrade to <span className="font-semibold">Director’s Cut</span> to create up to{" "}
          <span className="font-mono">{premiumLimit}</span> clubs.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-3 py-1.5 text-sm text-zinc-300 hover:bg-white/5">
            Cancel
          </button>
          <Link
            to="/premium"
            className="rounded-xl bg-yellow-400 px-3 py-1.5 text-sm font-medium text-black hover:bg-yellow-300"
          >
            Upgrade
          </Link>
        </div>
      </div>
    </div>
  );
}
