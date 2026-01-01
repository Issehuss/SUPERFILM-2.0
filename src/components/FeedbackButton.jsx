import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-hot-toast";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";

export default function FeedbackButton({
  variant = "floating", // "floating" (old bottom-right) or "menu"
  className = "",
  onOpen,
}) {
  const { user } = useUser();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const page = location?.pathname || "";

  const closeModal = () => {
    setOpen(false);
    if (onOpen) onOpen(false);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("Please add a short note.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("feedback").insert({
        user_id: user?.id || null,
        email: user?.email || null,
        message: message.trim(),
        page,
      });
      if (error) {
        if (error.code === "23505") {
          toast.error("Please wait a moment before sending more feedback.");
          return;
        }
        toast.error("Something went wrong. Please try again.");
        return;
      }
      toast.success("Thanks for the feedback!");
      setMessage("");
      closeModal();
    } catch (err) {
      toast.error(err?.message || "Could not send feedback.");
    } finally {
      setBusy(false);
    }
  };

  const triggerClass = useMemo(() => {
    if (variant === "menu") {
      return (
        "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 rounded-2xl " +
        className
      );
    }
    return (
      "fixed bottom-4 right-4 z-40 rounded-full bg-yellow-400 text-black px-4 py-2 text-sm font-semibold " +
      "shadow-[0_10px_30px_rgba(0,0,0,0.35)] hover:bg-yellow-300 transition " +
      className
    );
  }, [variant, className]);

  const triggerLabel = variant === "menu" ? "Send feedback" : "Feedback";

  const handleOpen = () => {
    setOpen(true);
    if (onOpen) onOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={triggerClass}
        aria-label="Send feedback"
      >
        {triggerLabel}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-zinc-950 border border-white/10 shadow-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Send Feedback</h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-zinc-400 hover:text-white text-sm"
              >
                Close
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              Tell us what’s working, what’s not, or what you want to see next.
            </p>
            <form onSubmit={onSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-500">Page</label>
                <div className="mt-1 text-sm text-zinc-200 bg-black/40 rounded-lg px-3 py-2 border border-white/5">
                  {page || "/"}
                </div>
              </div>
              <div>
                <label className="text-xs text-zinc-500">Message</label>
                <textarea
                  className="mt-1 w-full rounded-lg bg-black/50 border border-white/10 text-sm text-white p-3 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Share your thoughts…"
                  disabled={busy}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-sm px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white"
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-sm px-3 py-2 rounded-lg bg-yellow-400 text-black font-semibold hover:bg-yellow-300 disabled:opacity-60"
                  disabled={busy}
                >
                  {busy ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
