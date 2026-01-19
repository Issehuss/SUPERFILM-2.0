import { useEffect, useState, useRef } from "react";
import { MessageSquare, Users, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";
import useRealtimeResume from "../hooks/useRealtimeResume";

/**
 * Small, self-contained teaser. No styled-components, no macros.
 * The animated edge is pure CSS (see step 2).
 */
export default function ClubChatTeaserCard({ clubId, slug }) {
  const navigate = useNavigate();
  const { user } = useUser();
  const [last, setLast] = useState(null);
  const [unread, setUnread] = useState(0);
  const [online, setOnline] = useState(0);
  const pres = useRef(null);
  const ENABLE_PRESENCE = false;
  const resumeTick = useRealtimeResume();

  // Non-breaking: if supabase isn’t ready, it’ll just render static UI
  useEffect(() => {
    if (!clubId || !user?.id) return;

    const fetchData = async () => {
      // last message
      const { data: lastMsg } = await supabase
        .from("club_messages")
        .select("body, created_at")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setLast(lastMsg);

      // unread since last read
      const { data: readRow } = await supabase
        .from("club_message_reads")
        .select("last_read_at")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .maybeSingle();

      const since = readRow?.last_read_at ?? "1970-01-01";
      const { count } = await supabase
        .from("club_messages")
        .select("*", { count: "exact", head: true })
        .eq("club_id", clubId)
        .gt("created_at", since);
      setUnread(count ?? 0);
    };

    fetchData();

    // realtime bump + presence
    const msgCh = supabase
      .channel(`club-chat-${clubId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "club_messages", filter: `club_id=eq.${clubId}` },
        () => setUnread((u) => u + 1)
      )
      .subscribe();

    if (ENABLE_PRESENCE) {
      pres.current = supabase.channel(`presence-club-${clubId}`, {
        config: { presence: { key: user.id } },
      });

      pres.current
        .on("presence", { event: "sync" }, () => {
          const members = Object.values(pres.current.presenceState() || {}).flat();
          setOnline(members.length);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await pres.current.track({ user_id: user.id, at: Date.now() });
          }
        });
    }

    return () => {
      if (msgCh) supabase.removeChannel(msgCh);
      if (pres.current) supabase.removeChannel(pres.current);
    };
  }, [clubId, user?.id, ENABLE_PRESENCE, resumeTick]);

// inside the component
const go = () => {
    if (slug) navigate(`/clubs/${slug}/chat`);     // pretty URL
    else navigate(`/club/${clubId}/chat`);         // legacy fallback
  };
  
  return (
    <button
      type="button"
      onClick={go}
      className="chat-teaser group w-full overflow-hidden rounded-3xl relative"
      aria-label="Open club chat"
    >
      {/* animated edge (via ::before in CSS) */}
      <div className="rounded-3xl bg-[#0f0f0f] px-4 py-3 md:px-5 md:py-4 relative">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
              <MessageSquare className="w-5 h-5 text-yellow-400" />
            </div>
            {unread > 0 && (
              <span className="absolute -top-2 -right-2 bg-yellow-400 text-black text-xs font-bold rounded-full px-2 py-0.5">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-white/90 font-semibold">Club Chat</h3>
              <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-yellow-400 transition-colors" />
            </div>
            <p className="text-sm text-white/60 truncate">
              {last?.body ? last.body : "Be the first to say hello 👋"}
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs text-white/40">
              <Users className="w-3.5 h-3.5" />
              <span>{online} online</span>
            </div>
          </div>
        </div>
      </div>

      {/* soft glow under the moving arc */}
      <div className="pointer-events-none absolute inset-0 rounded-3xl glow-mask" />
    </button>
  );
}
