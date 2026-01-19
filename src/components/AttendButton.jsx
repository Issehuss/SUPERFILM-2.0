// src/components/AttendButton.jsx
import { useEffect, useState } from "react";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";

export default function AttendButton({ clubId, eventId, className = "" }) {
  const { user } = useUser();
  const [attending, setAttending] = useState(false);
  const [busy, setBusy] = useState(true); // start busy while we check

  useEffect(() => {
    let alive = true;
    let retryTimer;
    async function load() {
      const { data: auth } = await supabase.auth.getSession();
      const sessionUserId = auth?.session?.user?.id || null;
      const resolvedUserId = user?.id || sessionUserId;
      if (!resolvedUserId || !clubId || !eventId) {
        if (alive) setBusy(false);
        if (!resolvedUserId) retryTimer = setTimeout(load, 500);
        return;
      }
      const { data, error } = await supabase
        .from("event_attendance")
        .select("id")
        .eq("club_id", clubId)
        .eq("event_id", eventId)
        .eq("user_id", resolvedUserId)
        .maybeSingle();
      if (alive) {
        setAttending(Boolean(data?.id));
        setBusy(false);
      }
      if (error) console.warn("attendance check error:", error?.message);
    }
    load();
    return () => {
      alive = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [user?.id, clubId, eventId]);

  async function handleAttend() {
    if (!user?.id) return; // optionally route to sign-in
    setBusy(true);
    const { error } = await supabase.from("event_attendance").insert([{
      club_id: clubId,
      event_id: eventId,
      user_id: user.id,
      source: "self",
      checked_in_by: null,
    }]);
    setBusy(false);
    if (error) {
      // Ignore duplicate check-in gracefully
      const dup = String(error.message || "").toLowerCase().includes("duplicate key");
      if (!dup) {
        console.warn("attendance insert error:", error.message);
        return;
      }
    }
    setAttending(true);

    // Let the leaderboard/card refresh
    window.dispatchEvent(new CustomEvent("points-updated", { detail: { clubId } }));
  }

  // Button states
  if (!user?.id) {
    return (
      <button
        type="button"
        className={`rounded-lg border border-zinc-700 bg-black/40 px-3 py-1.5 text-sm text-zinc-300 ${className}`}
        title="Sign in to attend"
        disabled
      >
        Attend
      </button>
    );
  }

  if (attending) {
    return (
      <button
        type="button"
        className={`rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-white ${className}`}
        disabled
        title="You're marked as attended"
      >
        Attending ✓
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleAttend}
      disabled={busy}
      className={`rounded-lg bg-yellow-500/90 px-3 py-1.5 text-sm font-medium text-black hover:bg-yellow-400 disabled:opacity-60 ${className}`}
      title="Mark attendance"
    >
      {busy ? "…" : "Attend"}
    </button>
  );
}
