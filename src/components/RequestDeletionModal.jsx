import { X, Mail } from "lucide-react";
import { PARTNER_EMAIL, SUPPORT_EMAIL, mailto } from "../config/support";

export default function RequestDeletionModal({ open, onClose, clubName, clubSlug, clubId, requesterEmail }) {
  if (!open) return null;

  const subject = `Club deletion request: ${clubName || clubSlug || clubId}`;
  const bodyLines = [
    "Hi team,",
    "",
    `I'd like to request deletion/archival of the club:`,
    `• Name: ${clubName || "(unnamed)"}`,
    `• Slug/ID: ${clubSlug || clubId}`,
    requesterEmail ? `• Requested by: ${requesterEmail}` : null,
    "",
    "Reason:",
    "(please add your reason here)",
    "",
    "Thanks!"
  ].filter(Boolean);
  const body = bodyLines.join("\n");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* backdrop */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70"
      />
      {/* dialog */}
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-2xl bg-zinc-950 text-white ring-1 ring-white/10 shadow-2xl p-5"
      >
        <button
          aria-label="Close dialog"
          onClick={onClose}
          className="absolute top-3 right-3 rounded-full p-2 hover:bg-white/10"
        >
          <X size={18} />
        </button>

        <h2 className="text-xl font-semibold">Request club deletion</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Clubs can’t be deleted in-app. To remove <strong>{clubName || clubSlug || clubId}</strong>,
          please email a company partner. We’ll review and confirm once complete.
        </p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href={mailto(PARTNER_EMAIL, subject, body)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-yellow-500 text-black font-semibold px-3 py-2 hover:bg-yellow-400"
          >
            <Mail size={16} /> Email Partner
          </a>
          <a
            href={mailto(SUPPORT_EMAIL, subject, body)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 hover:bg-white/15"
          >
            <Mail size={16} /> Email Support
          </a>
        </div>

        <div className="mt-4 text-xs text-zinc-400">
          Partner: <span className="text-zinc-200">{PARTNER_EMAIL}</span> • Support:{" "}
          <span className="text-zinc-200">{SUPPORT_EMAIL}</span>
        </div>
      </div>
    </div>
  );
}
