// src/components/polls/PollCard.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import supabase from "lib/supabaseClient";
import { useUser } from "../../context/UserContext";
import useRealtimeResume from "../../hooks/useRealtimeResume";

export default function PollCard({ pollId }) {
  const { user } = useUser();
  const uid = user?.id || null;

  const rootRef = useRef(null);
  const [poll, setPoll] = useState(null);
  const [options, setOptions] = useState([]);
  const [myVotes, setMyVotes] = useState(new Set());     // Set<option_id>
  const [counts, setCounts] = useState({});              // { [option_id]: number }
  const [isVisible, setIsVisible] = useState(true);
  const resumeTick = useRealtimeResume();

  const totalVotes = useMemo(
    () => Object.values(counts).reduce((a, b) => a + b, 0),
    [counts]
  );

  const buildCounts = useCallback((opts, allVotes) => {
    const c = {};
    (opts || []).forEach(o => (c[o.id] = 0));
    (allVotes || []).forEach(v => { c[v.option_id] = (c[v.option_id] || 0) + 1; });
    return c;
  }, []);

  const load = useCallback(async () => {
    if (!pollId) return;
    const [{ data: p }, { data: opts }, { data: my }, { data: all }] = await Promise.all([
      supabase
        .from("chat_polls")
        .select("id, question, allow_multiple, is_closed, creator_id")
        .eq("id", pollId)
        .single(),
      supabase
        .from("chat_poll_options")
        .select("id, poll_id, text, idx")
        .eq("poll_id", pollId)
        .order("idx", { ascending: true }),
      supabase.from("chat_poll_votes").select("option_id").eq("poll_id", pollId).eq("voter_id", uid || ""),
      supabase.from("chat_poll_votes").select("option_id").eq("poll_id", pollId),
    ]);

    setPoll(p);
    setOptions(opts || []);
    setMyVotes(new Set((my || []).map(v => v.option_id)));
    setCounts(buildCounts(opts || [], all || []));
  }, [pollId, uid, buildCounts]);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Track visibility on screen to avoid background polling
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsVisible(!!entry?.isIntersecting);
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => {
      try {
        obs.disconnect();
      } catch {}
    };
  }, []);

  // Realtime (if available)
  useEffect(() => {
    if (!pollId) return;
    const ch = supabase
      .channel(`poll-${pollId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_poll_votes", filter: `poll_id=eq.${pollId}` }, load)
      .on("postgres_changes", { event: "update", schema: "public", table: "chat_polls", filter: `id=eq.${pollId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pollId, load, resumeTick]);

  // Lightweight polling fallback (only when visible)
  useEffect(() => {
    if (!pollId || !isVisible) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const interval = setInterval(load, 12000);
    const onFocus = () => load();
    const onVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pollId, load, isVisible]);

  // Optimistic vote helper
  const applyOptimistic = useCallback((optionId) => {
    setCounts(prev => {
      const next = { ...prev };
      const isMulti = !!poll?.allow_multiple;

      if (isMulti) {
        // Toggle this option only
        const selected = myVotes.has(optionId);
        next[optionId] = Math.max(0, (next[optionId] || 0) + (selected ? -1 : 1));
      } else {
        // Single-choice: remove any previous selection then select the new one
        myVotes.forEach(oldId => {
          if (oldId !== optionId) next[oldId] = Math.max(0, (next[oldId] || 0) - 1);
        });
        if (!myVotes.has(optionId)) next[optionId] = (next[optionId] || 0) + 1;
      }
      return next;
    });

    setMyVotes(prev => {
      const isMulti = !!poll?.allow_multiple;
      if (isMulti) {
        const ns = new Set(prev);
        ns.has(optionId) ? ns.delete(optionId) : ns.add(optionId);
        return ns;
      } else {
        return new Set([optionId]);
      }
    });
  }, [myVotes, poll?.allow_multiple]);

  const cast = async (optionId) => {
    if (!uid || !poll || poll.is_closed) return;

    // Optimistic UI first
    applyOptimistic(optionId);

    // Server call
    const { error } = await supabase.rpc("cast_vote", { p_poll_id: pollId, p_option_id: optionId });

    // If server rejected, reload to correct state
    if (error) {
      console.error("[poll] cast_vote failed:", error.message);
      await load();
      alert(error.message);
    }
  };

  const closePoll = async () => {
    if (!poll || poll.is_closed) return;
    const { error } = await supabase
      .from("chat_polls")
      .update({ is_closed: true })
      .eq("id", pollId);
    if (error) {
      alert(error.message);
    } else {
      // local state update for instant feedback
      setPoll(prev => prev ? { ...prev, is_closed: true } : prev);
    }
  };

  if (!poll) return null;

  return (
    <div ref={rootRef} className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm text-zinc-400">Poll</div>
          <h4 className="text-lg font-semibold">{poll.question}</h4>
          <div className="text-xs text-zinc-400 mt-1">
            {poll.allow_multiple ? "Multiple answers allowed" : "Single answer"} · {totalVotes} vote{totalVotes === 1 ? "" : "s"}
            {poll.is_closed && " · Closed"}
          </div>
        </div>

        {!poll.is_closed && poll.creator_id === uid && (
          <button
            onClick={closePoll}
            className="px-3 py-1 rounded-lg bg-yellow-400 text-black text-sm font-medium hover:bg-yellow-300"
          >
            Close poll
          </button>
        )}
      </div>

      <div className="space-y-2">
        {options.map((o) => {
          const c = counts[o.id] || 0;
          const pct = totalVotes ? Math.round((c / totalVotes) * 100) : 0;
          const selected = myVotes.has(o.id);

          return (
            <button
              key={o.id}
              onClick={() => !poll.is_closed && cast(o.id)}
              disabled={poll.is_closed || !uid}
              className={`w-full text-left rounded-xl border p-3 transition ${
                selected
                  ? "border-yellow-400 bg-yellow-400/10"
                  : "border-zinc-800 bg-zinc-800/60 hover:bg-zinc-800"
              } ${poll.is_closed ? "opacity-60 cursor-not-allowed" : ""}`}
              aria-pressed={selected}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium">{o.text}</span>
                <span className="text-sm text-zinc-400">{c}</span>
              </div>
              <div className="h-2 rounded-md bg-zinc-700 overflow-hidden">
                <div className="h-full bg-yellow-400" style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
