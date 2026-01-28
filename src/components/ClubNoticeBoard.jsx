// src/components/ClubNoticeBoard.jsx
import { useEffect, useState, useMemo } from "react";
import { useUser } from "../context/UserContext";
import supabase from "lib/supabaseClient";
import { Pin, Plus, History as HistoryIcon, ChevronDown } from "lucide-react";
import useRealtimeResume from "../hooks/useRealtimeResume";
import useSafeSupabaseFetch from "../hooks/useSafeSupabaseFetch";
import useAppResume from "../hooks/useAppResume";

const LEADER_ROLES = ["president", "vice_president"];
const noticeCache = new Map();

export default function ClubNoticeBoard({ clubId }) {
  const { user, isReady } = useUser();
  const cachedNotices = clubId ? noticeCache.get(clubId) : null;
  const initialCurrent = cachedNotices?.current || null;
  const initialHistory = Array.isArray(cachedNotices?.history)
    ? [...cachedNotices.history]
    : [];
  const [current, setCurrent] = useState(initialCurrent);
  const [history, setHistory] = useState(initialHistory);
  const [loading, setLoading] = useState(!Boolean(cachedNotices));

  // compose
  const [composeOpen, setComposeOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "" });

  // history
  const [historyOpen, setHistoryOpen] = useState(false);
  const resumeTick = useRealtimeResume();
  const appResumeTick = useAppResume();

  // role gating
  const [isLeader, setIsLeader] = useState(false);
  const canCompose = useMemo(() => Boolean(user?.id && isLeader), [user?.id, isLeader]);

  // ---- fetch leader role for this club (client UX; RLS still enforces on server) ----
  const { data: leaderRow } = useSafeSupabaseFetch(
    async () => {
      if (!clubId) throw new Error("no-club");
      const resolvedUserId = user?.id;
      if (!resolvedUserId) throw new Error("no-user");
      const { data, error } = await supabase
        .from("club_members")
        .select("club_id, user_id, role, joined_at, accepted")
        .eq("club_id", clubId)
        .eq("user_id", resolvedUserId)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },
    [clubId, user?.id, appResumeTick],
    { enabled: Boolean(clubId && user?.id && isReady), timeoutMs: 8000 }
  );

  useEffect(() => {
    const role = (leaderRow?.role || "").toLowerCase();
    setIsLeader(LEADER_ROLES.includes(role));
  }, [leaderRow]);

  // ---- load current + history ----
  const { data: noticesResult, loading: noticesLoading, retry: retryNotices } =
    useSafeSupabaseFetch(
      async () => {
        if (!clubId) throw new Error("no-club");
        const [{ data: cur }, { data: hist }] = await Promise.all([
          supabase
            .from("club_notice_current")
            .select("id, title, body, created_at")
            .eq("club_id", clubId)
            .maybeSingle(),
          supabase
            .from("club_notice_history")
            .select("id, title, body, created_at, archived_at")
            .eq("club_id", clubId)
            .order("archived_at", { ascending: false })
            .limit(20),
        ]);
        return { current: cur || null, history: hist || [] };
      },
      [clubId, resumeTick, appResumeTick],
      {
        enabled: Boolean(clubId),
        timeoutMs: 8000,
        initialData: cachedNotices || null,
      }
    );

  useEffect(() => {
    if (cachedNotices) {
      setLoading(false);
      return;
    }
    setLoading(noticesLoading);
  }, [cachedNotices, noticesLoading]);

  useEffect(() => {
    if (!clubId) {
      setCurrent(null);
      setHistory([]);
      return;
    }
    if (cachedNotices) {
      setCurrent(cachedNotices.current || null);
      setHistory(
        Array.isArray(cachedNotices.history) ? cachedNotices.history : []
      );
      return;
    }
    setCurrent(null);
    setHistory([]);
  }, [cachedNotices, clubId]);

  useEffect(() => {
    if (!noticesResult) return;
    setCurrent(noticesResult.current || null);
    setHistory(Array.isArray(noticesResult.history) ? noticesResult.history : []);
  }, [noticesResult]);

  useEffect(() => {
    if (!clubId || !noticesResult) return;
    const cachedHistory = Array.isArray(noticesResult.history)
      ? [...noticesResult.history]
      : [];
    noticeCache.set(clubId, {
      current: noticesResult.current || null,
      history: cachedHistory,
    });
  }, [clubId, noticesResult]);

  useEffect(() => {
    const ch = supabase
      .channel(`notices:${clubId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "club_notices", filter: `club_id=eq.${clubId}` },
        () => retryNotices()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId, resumeTick]);

  // ---- publish/replace (leaders only; server double-checks via RLS/RPC) ----
  async function submit() {
    if (!canCompose) {
      alert("Only club leaders can post notices.");
      return;
    }
    if (!form.title.trim()) return;
    const { error } = await supabase.rpc("club_notice_replace", {
      p_club_id: clubId,
      p_author_id: user?.id,
      p_title: form.title.trim(),
      p_body: form.body?.trim() || null,
    });
    if (error) {
      alert(error.message || "Failed to post notice.");
      return;
    }
  // Force UI refresh even if realtime doesn’t arrive
  await retryNotices();
    setForm({ title: "", body: "" });
    setComposeOpen(false);
  }


  return (
    <section className="rounded-2xl bg-white/5 ring-1 ring-white/10">
      <div className="p-5 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Notice Board</h3>

        {/* Show compose only to leaders */}
        {canCompose && (
          <button
            onClick={() => setComposeOpen(v => !v)}
            className="inline-flex items-center gap-2 text-sm rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/15"
          >
            <Plus size={16}/> New notice
          </button>
        )}
      </div>

      {composeOpen && canCompose && (
        <div className="px-5 pb-4 grid gap-2">
          <input
            className="bg-white/10 rounded-lg px-3 py-2 outline-none"
            placeholder="Title"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
          />
          <textarea
            rows={3}
            className="bg-white/10 rounded-lg px-3 py-2 outline-none resize-y"
            placeholder="Details (optional)"
            value={form.body}
            onChange={e => setForm({ ...form, body: e.target.value })}
          />
          <div className="flex gap-2">
            <button
              onClick={submit}
              className="rounded-full bg-yellow-500 text-black font-semibold px-4 py-2 hover:bg-yellow-400"
            >
              Publish
            </button>
            <button
              onClick={() => setComposeOpen(false)}
              className="rounded-full bg-white/10 px-4 py-2 hover:bg-white/15"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Current notice */}
      <div className="px-5 pb-4">
        {loading ? (
          <div className="h-24 rounded-xl bg-white/10 animate-pulse" />
        ) : current ? (
          <div className="p-4 rounded-xl ring-1 ring-white/10 bg-white/5 border-2 border-yellow-400">
            <div className="flex items-start justify-between gap-3">
              <div className="w-full">
                {/* Boosted visibility label */}
                <div className="inline-flex items-center gap-2 rounded-full bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30 px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase">
                  <Pin size={12} /> Pinned Notice
                </div>
                <h4 className="font-semibold mt-2">{current.title}</h4>
                {current.body && (
                  <p className="text-sm text-zinc-300 mt-1 whitespace-pre-wrap">
                    {current.body}
                  </p>
                )}
              </div>
              <span className="text-xs text-zinc-500 shrink-0">
                {new Date(current.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-zinc-400">
            No active notice yet.
            {/* Everyone can see that it’s empty */}
          </div>
        )}
      </div>

      {/* History */}
      <button
        onClick={() => setHistoryOpen(v => !v)}
        className="w-full px-5 py-3 text-left text-sm flex items-center justify-between hover:bg-white/5"
      >
        <span className="inline-flex items-center gap-2">
          <HistoryIcon size={16}/> History
        </span>
        <ChevronDown
          size={16}
          className={`transition ${historyOpen ? "rotate-180" : ""}`}
        />
      </button>

      {historyOpen && (
        <ul className="divide-y divide-white/10">
          {history.length ? (
            history.map(h => (
              <li key={h.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h5 className="font-medium">{h.title}</h5>
                    {h.body && (
                      <p className="text-sm text-zinc-400 mt-1 line-clamp-3">
                        {h.body}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">
                    {h.archived_at
                      ? `Archived ${new Date(h.archived_at).toLocaleString()}`
                      : new Date(h.created_at).toLocaleString()}
                  </span>
                </div>
              </li>
            ))
          ) : (
            <li className="p-5 text-sm text-zinc-400">No previous notices.</li>
          )}
        </ul>
      )}
    </section>
  );
}
