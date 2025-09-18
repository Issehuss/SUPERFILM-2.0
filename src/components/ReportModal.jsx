// src/components/ReportModal.jsx
import { useState } from "react";
import useReports from "../hooks/useReports";

const REASONS = [
  { value: "abuse",             label: "Abuse" },
  { value: "harassment",        label: "Harassment" },
  { value: "spam",              label: "Spam" },
  { value: "nsfw",              label: "NSFW" },
  { value: "hate speech",       label: "Hate Speech" },
  { value: "self-harm content", label: "Self-harm content" },
  { value: "other",             label: "Other" },
];

export default function ReportModal({
  open,
  onClose,
  targetType = "general", // e.g. "message" or "general"
  targetId = null,        // message id when reporting a message
  clubId = null,          // optional
}) {
  const { reportContent } = useReports();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await reportContent({
        targetType,
        targetId,   // may be null for general feedback
        clubId,
        reason,     // if not in enum, hook coerces to 'other' and preserves text in details
        details: details.trim(),
      });
      onClose?.({ ok: true });
    } catch (e) {
      console.error(e);
      alert(e?.message || "Couldn’t submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-white">Report</h3>
          <button onClick={() => onClose?.()} className="text-zinc-400 hover:text-white">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {REASONS.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReason(r.value)}
              className={`px-3 py-2 rounded-lg border ${
                reason === r.value
                  ? "bg-yellow-500 text-black border-yellow-400"
                  : "bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Only show free text when "Other" or anytime you like */}
        <label className="block text-sm text-zinc-400 mt-4 mb-1">Details (optional)</label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={4}
          className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 text-white p-2"
          placeholder="Tell us what happened…"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => onClose?.()} className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200">
            Cancel
          </button>
          <button
            disabled={!reason || submitting}
            onClick={handleSubmit}
            className="px-3 py-2 rounded-lg bg-yellow-500 text-black disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}
