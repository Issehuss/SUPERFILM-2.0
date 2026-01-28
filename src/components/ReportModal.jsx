// src/components/ReportModal.jsx
import { useState, useMemo } from "react";
import { X } from "lucide-react";
import supabase from "lib/supabaseClient";
import { useUser } from "../context/UserContext";

// Human label -> enum token (adjust to your enum)
const REASON_MAP = {
  "Spam": "spam",
  "Harassment or hate": "harassment",
  "Self-harm content": "self_harm",
  "Violence or threats": "violence",
  "Scam or fraud": "scam",
  "Nudity / sexual content": "nudity",
  "Other": "other",
};
const ENUM_TOKENS = ["spam", "harassment", "self_harm", "violence", "scam", "nudity", "other"];

// ID helpers: accept UUID or numeric ids
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INT_RX = /^\d+$/;
const isValidId = (x) => UUID_RX.test(String(x)) || INT_RX.test(String(x));

// Normalize target type for your enum
function normalizeTargetType(x) {
  const s = (x || "message").toString().toLowerCase();
  return s; // change to 'club_message' if that's your DB enum
}

export default function ReportModal({ open, onClose, targetType, targetId, clubId }) {
  const { user } = useUser();
  const [reasonLabel, setReasonLabel] = useState("Spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const reasonToken = useMemo(() => {
    const token = REASON_MAP[reasonLabel] || "other";
    return ENUM_TOKENS.includes(token) ? token : "other";
  }, [reasonLabel]);

  if (!open) return null;

  async function submit() {
    setSubmitting(true);
    setErrorMsg("");

    try {
      if (!user?.id) throw new Error("You must be signed in to report.");
      const tt = normalizeTargetType(targetType);

      // Guard: we expect a valid UUID or integer id
      if (tt === "message" && !isValidId(targetId)) {
        throw new Error("This message hasn’t been fully saved yet. Please try again in a moment.");
      }

      const finalDetails =
        reasonToken === "other" && reasonLabel !== "Other"
          ? `[Chosen: ${reasonLabel}] ${details || ""}`.trim()
          : details || null;

      const payload = {
        club_id: clubId || null,
        target_type: tt,
        target_id: targetId,     // may be uuid or bigint (ensure DB column matches)
        reason: reasonToken,     // enum-safe token
        details: finalDetails,   // text or null
        created_by: user.id,     // satisfies typical RLS
      };

      const { error } = await supabase.from("reports").insert(payload);
      if (error) {
        const parts = [error.code, error.message, error.details, error.hint]
          .filter(Boolean)
          .join(" — ");
        throw new Error(parts || "DB insert failed");
      }

      onClose?.();
    } catch (e) {
      console.error("[Report] submit failed:", e);
      setErrorMsg(e.message || "Couldn’t submit report.");
    } finally {
      setSubmitting(false);
    }
  }
  console.log("[ReportModal] targetId:", targetId);


  return (
    <div className="fixed inset-0 z-[2000]">
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !submitting && onClose?.()}
      />

      {/* Dialog */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <h3 className="font-semibold">Report message</h3>
            <button
              onClick={() => !submitting && onClose?.()}
              className="rounded-lg p-1 hover:bg-zinc-800"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-4 py-4 space-y-4">
            <div>
              <label className="block text-sm mb-1">Reason</label>
              <select
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2"
                value={reasonLabel}
                onChange={(e) => setReasonLabel(e.target.value)}
                disabled={submitting}
              >
                {Object.keys(REASON_MAP).map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-400">
                Saved as <code className="text-zinc-300">{reasonToken}</code>
              </p>
            </div>

            <div>
              <label className="block text-sm mb-1">Details (optional)</label>
              <textarea
                rows={4}
                className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 resize-none"
                placeholder="Tell us what happened…"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                disabled={submitting}
              />
            </div>

            {errorMsg && (
              <div className="text-sm text-red-400">{errorMsg}</div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
            <button
              onClick={() => onClose?.()}
              disabled={submitting}
              className="rounded-lg px-3 py-2 border border-zinc-800 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="rounded-lg px-3 py-2 bg-yellow-500 text-black hover:bg-yellow-400 disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit report"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
