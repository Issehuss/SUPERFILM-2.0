import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Users, Image as ImageIcon, X } from "lucide-react";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";
import MessageItem from "../components/MessageItem";
import useReports from "../hooks/useReports";
import ReportModal from "../components/ReportModal";
import PollComposer from "../components/polls/PollComposer";
import { Plus } from "lucide-react";   // for the tools button







/**
 * ClubChat.jsx — page-scroll version (no inner scrollbar)
 * ----------------------------------------------------------------------
 * Avatars:
 * - Initial fetch loads messages, then hydrates sender profiles (avatar_url, display_name, slug)
 * - Realtime INSERT also hydrates the sender’s profile
 * - Optimistic sends include the current user's profile so your own avatar shows instantly
 *
 * Scrolling:
 * - Removed inner container overflow/height; page owns scrolling now
 * - scrollToBottom() scrolls window/document
 * ----------------------------------------------------------------------
 */

const PAGE_SIZE = 50;
const CHAT_BUCKET = "chat-images";

export default function ClubChat() {
  // Params: could be an actual UUID, or a slug
  const { clubId: legacyClubId } = useParams(); // legacy /club/:clubId/chat
  const { clubParam } = useParams();            // new     /clubs/:clubParam/chat

  const navigate = useNavigate();
  const { user } = useUser();
  const { reportContent } = useReports();

  // State that will always hold the real UUID
  const [clubId, setClubId] = useState(null);
  

  // Resolve the route param (could be UUID or slug) into a real UUID
useEffect(() => {
  const routeId = (clubParam ?? legacyClubId) || "";
  if (!routeId) return;

  const UUID_RX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (UUID_RX.test(routeId)) {
    setClubId(routeId);
    return;
  }

  let cancelled = false;
  (async () => {
    const { data, error } = await supabase
  .from("v_club_messages")
  .select("*")
  .eq("club_id", clubId)
  .order("created_at", { ascending: true });

const messages = (data || []).map(m => ({
  ...m,
  role: m.member_role,   // <- RoleBadge will use this
  profiles: {
    id: m.profile_id,
    slug: m.profile_slug,
    display_name: m.profile_display_name,
    avatar_url: m.profile_avatar_url,
  },
}));

setMessages(messages);
setLoading(false);


    if (!cancelled && data?.id) setClubId(data.id);
    if (error) console.error("Failed to load club by slug", error);
  })();

  return () => {
    cancelled = true;
  };
}, [clubParam, legacyClubId]);




  // allow either slug or id to be passed in the URL
  const [clubRow, setClubRow] = useState(null);
  const clubKey = (clubId || clubParam || "").trim();

  // messages + ui state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(0);

  // image compose state
  const [imageFile, setImageFile] = useState(null);
  const [imageObjectUrl, setImageObjectUrl] = useState("");

  // admin role
  const [isAdmin, setIsAdmin] = useState(false);

  const listRef = useRef(null);
  const composerRef = useRef(null);
  const presenceRef = useRef(null);
  const [reporting, setReporting] = useState(null); // {msg} or null
  const [showPollComposer, setShowPollComposer] = useState(false)
  const [showTools, setShowTools] = useState(false);



function handleReportMessage(msg) {
  setReporting({ msg });
}







  // --------- bootstrap: resolve club (slug → id if needed)
useEffect(() => {
  let cancelled = false;
  (async () => {
    if (!clubKey) return;
    setLoading(true);

    // Accept either UUID/id or slug
    const isUuid = /^[0-9a-f-]{10,}$/i.test(clubKey);
    const q = isUuid
      ? supabase.from("clubs").select("id, slug, name").eq("id", clubKey).maybeSingle()
      : supabase.from("clubs").select("id, slug, name").eq("slug", clubKey).maybeSingle();

    const { data, error } = await q;
    if (cancelled) return;

    if (error) {
      console.error("Failed to resolve club:", error);
    }
    if (data) {
      setClubRow(data);
      // normalize pretty URL if they hit the legacy path
      if (!clubId && clubParam && data.slug && clubParam !== data.slug) {
        navigate(`/clubs/${data.slug}/chat`, { replace: true });
      }
    }
    setLoading(false);
  })();
  return () => {
    cancelled = true;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [clubKey]);

// Always prefer the resolved row's id
const resolvedClubId = clubRow?.id || clubId || null;
const me = user?.id;

// --------- fetch messages from the view (brings role + profile fields)
useEffect(() => {
  let active = true;
  (async () => {
    if (!resolvedClubId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("v_club_messages")
      .select("*")
      .eq("club_id", resolvedClubId)
      .order("created_at", { ascending: true });

    if (!active) return;

    if (error) {
      console.error("load messages failed:", error);
      setMessages([]); // or keep previous
    } else {
      const msgs = (data || []).map((m) => ({
        ...m,
        role: m.member_role, // <- used by <RoleBadge />
        profiles: {
          id: m.profile_id,
          slug: m.profile_slug,
          display_name: m.profile_display_name,
          avatar_url: m.profile_avatar_url,
        },
      }));
      setMessages(msgs);
    }
    setLoading(false);
  })();

  return () => {
    active = false;
  };
}, [resolvedClubId]);


  // --------- detect admin role
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!resolvedClubId || !user?.id) return;
      const { data } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", resolvedClubId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        const role = data?.role || "";
        setIsAdmin(["president", "admin", "moderator"].includes(role));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedClubId, user?.id]);

  // --------- initial fetch + realtime INSERT (with profile hydration)
  useEffect(() => {
    if (!resolvedClubId) return;
    let cancelled = false;

    (async () => {
      // 1) Fetch messages ONLY (no join) so RLS on profiles can't hide rows
      const { data: rows, error: err1 } = await supabase
        .from("club_messages")
        .select("id, club_id, user_id, body, image_url, is_deleted, created_at, type, metadata")
        .eq("club_id", resolvedClubId)
        .order("created_at", { ascending: true })
        .limit(PAGE_SIZE);

      if (cancelled) return;

      if (err1) {
        console.error("[Chat] fetch messages error:", err1);
        setMessages([]);
        setLoading(false);
        return;
      }

      // 2) Hydrate sender profiles (best-effort)
      const uniqueUserIds = [...new Set((rows || []).map(r => r.user_id).filter(Boolean))];
      let profileMap = {};
      if (uniqueUserIds.length) {
        const { data: profs, error: err2 } = await supabase
          .from("profiles")
          .select("id, avatar_url, display_name, username")
          .in("id", uniqueUserIds);

        if (!cancelled && !err2 && profs) {
          profileMap = Object.fromEntries(profs.map(p => [p.id, p]));
        } else if (err2) {
          console.warn("[Chat] profiles fetch warning (check RLS):", err2);
        }
      }

      const hydrated = (rows || []).map(r => ({ ...r, profiles: profileMap[r.user_id] || null }));
      if (!cancelled) {
        setMessages(hydrated);
        requestAnimationFrame(scrollToBottom);
        setLoading(false);
      }

      // 3) Mark read
      if (!cancelled && user?.id) {
        await supabase
          .from("club_message_reads")
          .upsert({
            club_id: resolvedClubId,
            user_id: user.id,
            last_read_at: new Date().toISOString(),
          });
      }
    })();

    // 4) Realtime INSERT (hydrate sender’s profile)
   // 4) Realtime (INSERT + UPDATE)
const channel = supabase
.channel(`club-chat:${resolvedClubId}`)
// New message
.on(
  "postgres_changes",
  { event: "INSERT", schema: "public", table: "club_messages", filter: `club_id=eq.${resolvedClubId}` },
  async (payload) => {
    if (cancelled) return;
    const msg = payload.new;

    // hydrate sender profile best-effort
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, avatar_url, display_name, slug")
      .eq("id", msg.user_id)
      .maybeSingle();

    setMessages(prev => [...prev, { ...msg, profiles: profile || null }]);
    requestAnimationFrame(scrollToBottom);
  }
)
// Message update (e.g., deleted)
.on(
  "postgres_changes",
  { event: "UPDATE", schema: "public", table: "club_messages", filter: `club_id=eq.${resolvedClubId}` },
  (payload) => {
    if (cancelled) return;
    const updated = payload.new;
    setMessages(prev =>
      prev.map(m => (m.id === updated.id ? { ...m, ...updated } : m))
    );
  }
)
.subscribe();


    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    return (
      <div className="flex flex-col h-full">
        {/* ... your chat UI ... */}
    
        {reporting && (
          <ReportModal
            open
            onClose={() => setReporting(null)}
            targetType="message"
            targetId={reporting.msg.id}
            clubId={clubId}
          />
        )}
        {showPollComposer && clubId && (
  <PollComposer
    clubId={clubId}
    onClose={() => setShowPollComposer(false)}
    onCreated={async (pollId, question) => {
      // post a normal message that references the poll
      const { error } = await supabase.from("club_messages").insert({
        club_id: clubId,
        user_id: user?.id,
        body: ` Poll: ${question}`,   // readable fallback text
        type: "poll",
        metadata: { poll_id: pollId },
      });
      if (error) console.error(error);
      setShowPollComposer(false);
    }}
  />
)}

      </div>
    );
    
  }, [resolvedClubId, user?.id]);

  // --------- presence only (separate from INSERT subscription)
  useEffect(() => {
    if (!resolvedClubId) return;

    if (presenceRef.current) supabase.removeChannel(presenceRef.current);
    const presence = supabase.channel(`presence-club-${resolvedClubId}`, {
      config: { presence: { key: user?.id || Math.random().toString(36).slice(2) } },
    });
    presence.on("presence", { event: "sync" }, () => {
      const members = Object.values(presence.presenceState() || {}).flat();
      setOnline(members.length);
    });
    presence.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presence.track({ at: Date.now(), uid: user?.id || null });
      }
    });
    presenceRef.current = presence;

    return () => {
      if (presenceRef.current) supabase.removeChannel(presenceRef.current);
    };
  }, [resolvedClubId, user?.id]);

  // --------- input helpers
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  

  const onPickImage = (file) => {
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageObjectUrl(url);
  };

  const clearPickedImage = () => {
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    setImageObjectUrl("");
    setImageFile(null);
  };

  // --------- sending (text + optional image)
  const send = async () => {
    if (!resolvedClubId || !me || sending) return;

    const body = (input || "").trim();
    const hasImage = !!imageFile;
    if (!body && !hasImage) return;

    setSending(true);

    // Client-side banned-words warning (server trigger still blocks)
    try {
      if (body && (await messageViolatesFilter(body))) {
        alert("Your message appears to include banned language. Please edit it.");
        setSending(false);
        return;
      }
    } catch (e) {
      // ignore client check failures; server enforces anyway
    }

    // Clear input now (snappier UI)
    setInput("");

    // Optimistic UI — include current user's profile so avatar appears immediately
    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      id: tempId,
      club_id: resolvedClubId,
      user_id: me,
      body: body || null,
      image_url: imageObjectUrl || null, // preview immediately
      created_at: new Date().toISOString(),
      profiles: {
        id: me,
        avatar_url: user?.profileAvatarUrl || null,
        display_name: user?.name || null,
        username: user?.username || null,
      },
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();

    let uploadedImageUrl = null;
    try {
      // Upload image first (if any)
      if (hasImage) {
        uploadedImageUrl = await uploadChatImage(imageFile, resolvedClubId, me);
      }

      // Insert the real row
      const { data, error } = await supabase
        .from("club_messages")
        .insert([
          {
            club_id: resolvedClubId,
            user_id: me,
            body: body || null,
            image_url: uploadedImageUrl,
          },
        ])
        .select("id, created_at")
        .single();

      if (error) throw error;

      // Replace optimistic with real id/timestamp (keep already-shown profiles)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, id: data.id, created_at: data.created_at } : m
        )
      );

      // Mark as read
      await supabase.from("club_message_reads").upsert({
        club_id: resolvedClubId,
        user_id: me,
        last_read_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Send failed:", err?.message || err);
      // rollback optimistic
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      // restore input so user can edit/retry
      setInput(body);
      alert(err?.message || "Message failed to send.");
    } finally {
      // Cleanup image selection
      clearPickedImage();
      setSending(false);
    }
  };

  

  // --------- helpers
  const scrollToBottom = () => {
    try {
      // page owns the scroll now
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });
    } catch {}
  };

  

  // group messages by day (lightly)
  const grouped = useMemo(() => {
    const out = [];
    let lastDay = "";
    (messages || []).forEach((m) => {
      const day = new Date(m.created_at).toLocaleDateString();
      if (day !== lastDay) {
        out.push({ _type: "day", id: `d_${day}`, label: day });
        lastDay = day;
      }
      out.push(m);
    });
    return out;
  }, [messages]);

  // --------- moderation handlers
  async function handleDeleteMessage(msg) {
    try {
      // optimistic UI: flip to deleted now
      setMessages(prev =>
        prev.map(m =>
          m.id === msg.id
            ? { ...m, is_deleted: true, body: null, image_url: null }
            : m
        )
      );
  
      // best-effort remove image from storage
      if (msg.image_url) {
        const path = extractStoragePathFromPublicUrl(msg.image_url);
        if (path) await supabase.storage.from(CHAT_BUCKET).remove([path]);
      }
  
      const { error } = await supabase
        .from("club_messages")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          body: null,
          image_url: null,
        })
        .eq("id", msg.id);
  
      if (error) throw error;
    } catch (e) {
      console.error(e);
      // rollback if failed
      setMessages(prev =>
        prev.map(m =>
          m.id === msg.id
            ? { ...m, is_deleted: msg.is_deleted, body: msg.body, image_url: msg.image_url }
            : m
        )
      );
      alert("Couldn’t delete message.");
    }
  }
  
  // --------- moderation handlers
  async function handleDeleteMessage(msg) {
    try {
      // best-effort remove image from storage
      if (msg.image_url) {
        const path = extractStoragePathFromPublicUrl(msg.image_url);
        if (path) await supabase.storage.from(CHAT_BUCKET).remove([path]);
      }

      const { error } = await supabase
        .from("club_messages")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
          body: null,
          image_url: null,
        })
        .eq("id", msg.id);

      if (error) throw error;
    } catch (e) {
      console.error(e);
      alert("Couldn’t delete message.");
    }
  }

  async function handleDeleteMessage(msg) {
    if (!msg?.id) return;
  
    // Optimistic UI
    setMessages(prev =>
      prev.map(m =>
        m.id === msg.id ? { ...m, is_deleted: true } : m
      )
    );
  
    try {
      const { error } = await supabase
        .from("club_messages")
        .update({
          is_deleted: true,
          // optional audit fields if you created them:
          // deleted_at: new Date().toISOString(),
          // deleted_by: user.id,
        })
        .eq("id", msg.id);
  
      if (error) throw error;
    } catch (e) {
      console.error("[delete] supabase update failed:", e.message);
      alert("Could not delete message: " + e.message);
      // rollback
      setMessages(prev => prev.map(m => (m.id === msg.id ? { ...m, ...msg } : m)));
    }
  }


  // Permanently delete a message (admin/moderator only via RLS)
async function handleHardDeleteMessage(msg) {
  if (!msg?.id) return;

  try {
    // 1) (Optional) remove any stored image first (best-effort; ignore errors)
    if (msg.image_url) {
      try {
        const path = extractStoragePathFromPublicUrl(msg.image_url);
        if (path) await supabase.storage.from(CHAT_BUCKET).remove([path]);
      } catch (e) {
        console.warn("[hard delete] storage remove failed (ignored):", e?.message || e);
      }
    }

    // 2) Hard delete the row
    const { error } = await supabase
      .from("club_messages")
      .delete()
      .eq("id", msg.id);

    if (error) throw error;

    // 3) Update local state immediately (no realtime DELETE event)
    setMessages(prev => prev.filter(m => m.id !== msg.id));
  } catch (e) {
    console.error("[hard delete] supabase delete failed:", e?.message || e);
    alert(e?.message || "Couldn't permanently delete message.");
  }
}

  

  return (
    <div className="min-h-[calc(100vh-88px)] bg-gradient-to-b from-black via-zinc-950 to-black">
      {/* Header */}
      <div className="sticky top-0 z-10 mx-auto max-w-3xl px-4 pt-4">
        <div className="rounded-2xl border border-zinc-800 bg-black/50 backdrop-blur px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-full bg-zinc-900 hover:bg-zinc-800 p-1.5 border border-zinc-800"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <div className="font-semibold">Club Chat</div>
            <div className="text-xs text-zinc-400">You’re chatting with your club</div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Users size={14} />
            <span>{online} online</span>
          </div>
        </div>
      </div>

      {/* Messages list (no inner overflow/height) */}
      <div ref={listRef} className="mx-auto max-w-3xl px-4 pb-[168px] pt-4">
        {loading && (
          <div className="text-center text-zinc-400 py-12">Loading…</div>
        )}

        {!loading && messages.length === 0 && (
          <div className="text-center text-zinc-400 py-12">
            Be the first to say hello 👋
          </div>
        )}

        {!loading &&
          grouped.map((m) =>
            m._type === "day" ? (
              <div key={m.id} className="sticky top-2 z-0 my-4 flex items-center justify-center">
                <span className="px-3 py-1 rounded-full text-xs bg-zinc-900 text-zinc-400 border border-zinc-800">
                  {m.label}
                </span>
              </div>
            ) : (
              <MessageItem
              key={m.id}
              msg={m}
              isMe={m.user_id === me}
              isAdmin={isAdmin}
              onDelete={handleDeleteMessage}
              onHardDelete={handleHardDeleteMessage}   // NEW
              onReport={handleReportMessage}
            />
            
            )
          )}
      </div>

      {/* Composer – docked to bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-20 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-3xl px-4 pb-4">
          <div className="rounded-2xl border border-zinc-800 bg-black/70 backdrop-blur px-3 py-3">
            {/* Attach preview */}
            {imageObjectUrl && (
              <div className="mb-2 flex items-center gap-2">
                <div className="relative">
                  <img
                    src={imageObjectUrl}
                    alt="preview"
                    className="max-h-28 rounded-xl border border-zinc-800"
                  />
                  <button
                    type="button"
                    onClick={clearPickedImage}
                    className="absolute -top-2 -right-2 bg-zinc-900 border border-zinc-700 rounded-full p-1 hover:bg-zinc-800"
                    aria-label="Remove image"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="text-xs text-zinc-400">Image attached</div>
              </div>
            )}

{showPollComposer && (
  <PollComposer
    clubId={resolvedClubId}
    onClose={() => setShowPollComposer(false)}
    onCreated={async (pollId, question) => {
      try {
        // Insert a chat message referencing the poll
        const { data: newMsg, error } = await supabase
          .from("club_messages")
          .insert({
            club_id: resolvedClubId,
            user_id: user?.id,
            body: `Poll: ${question}`, // no emoji
            type: "poll",
            metadata: { poll_id: pollId },
          })
          .select("id, club_id, user_id, body, image_url, is_deleted, created_at, type, metadata")
          .single();

        if (error) throw error;

        // Optimistically add the message so it shows instantly
        const optimistic = {
          ...newMsg,
          profiles: {
            id: user?.id,
            avatar_url: user?.profileAvatarUrl || null,
            display_name: user?.name || null,
            username: user?.username || null,
          },
        };
        setMessages((prev) => [...prev, optimistic]);
        requestAnimationFrame(scrollToBottom);
      } catch (e) {
        console.error("Poll insert failed:", e);
        alert(e.message || "Couldn’t create poll message.");
      } finally {
        setShowPollComposer(false);
      }
    }}
  />
)}





{showPollComposer && (
  <PollComposer
    clubId={resolvedClubId}
    onClose={() => setShowPollComposer(false)}
    onCreated={async (pollId, question) => {
      try {
        const { data: newMsg, error } = await supabase
          .from("club_messages")
          .insert({
            club_id: resolvedClubId,   // ✅ use resolvedClubId
            user_id: user?.id,
            body: `Poll: ${question}`, // ✅ no emoji
            type: "poll",
            metadata: { poll_id: pollId },
          })
          .select("id, club_id, user_id, body, image_url, is_deleted, created_at, type, metadata")
          .single();

        if (error) throw error;

        // ✅ Optimistically append so it shows instantly
        setMessages(prev => [
          ...prev,
          {
            ...newMsg,
            profiles: {
              id: user?.id,
              avatar_url: user?.profileAvatarUrl || null,
              display_name: user?.name || null,
              username: user?.username || null,
            },
          },
        ]);
      } catch (e) {
        console.error("[Poll insert failed]", e);
        alert(e.message || "Couldn’t create poll message.");
      } finally {
        setShowPollComposer(false);
      }
    }}
  />
)}

            <div className="flex items-end gap-2">
              <label
                className="p-2 rounded-xl hover:bg-zinc-800 border border-transparent hover:border-zinc-700 cursor-pointer"
                title="Attach image"
              >
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickImage(e.target.files?.[0] || null)}
                />
                <ImageIcon size={20} />
              </label>

              {/* Tools launcher */}
<div className="relative">
  <button
    type="button"
    onClick={() => setShowTools((v) => !v)}
    className="rounded-xl px-2 py-2 border border-zinc-700 hover:border-zinc-600 bg-zinc-900 text-zinc-200"
    aria-haspopup="menu"
    aria-expanded={showTools}
    aria-label="Open tools"
  >
    <Plus size={18} />
  </button>

  {showTools && (
    <div className="absolute bottom-12 left-0 z-30 w-56 rounded-2xl border border-zinc-800 bg-zinc-950/98 shadow-2xl p-2">
      <div className="px-2 pb-2 text-xs text-zinc-400">Tools</div>

      {/* Poll tool */}
      <button
        type="button"
        onClick={() => {
          setShowTools(false);
          setShowPollComposer(true);
        }}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-zinc-800/60 text-sm text-zinc-200"
      >
        Create poll
      </button>

      {/* Future tools go here */}
    </div>
  )}
</div>


              <textarea
                ref={composerRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Write a message..."
                className="flex-1 resize-none bg-zinc-900 text-white text-sm rounded-xl px-3 py-2 outline-none border border-zinc-800 focus:border-yellow-500/60"
              />



              <button
                onClick={send}
                disabled={(!input.trim() && !imageFile) || sending || !user?.id}
                className="rounded-full w-10 h-10 shrink-0 grid place-items-center bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black"
                aria-label="Send"
              >
                <Send size={18} />
              </button>
            </div>
            <div className="text-[11px] text-zinc-500 mt-1 ml-1">
              Press <b>Enter</b> to send • <b>Shift+Enter</b> for a new line
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}





// -------------------------------
// Upload helper (Supabase Storage)
// -------------------------------
async function uploadChatImage(file, clubId, userId) {
  const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
  const path = `${clubId}/${userId}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(CHAT_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (upErr) throw upErr;

  // PUBLIC bucket path → public URL
  const publicUrl = supabase.storage.from(CHAT_BUCKET).getPublicUrl(path).data.publicUrl;
  return publicUrl;
}

// -------------------------------
// Banned-words precheck (client)
// -------------------------------
async function messageViolatesFilter(text) {
  try {
    const { data } = await supabase.from("banned_words").select("pattern");
    if (!data) return false;
    for (const { pattern } of data) {
      try {
        if (new RegExp(pattern).test(text)) return true;
      } catch {}
    }
    return false;
  } catch {
    return false; // fail-open client; server trigger enforces anyway
  }
}

// -------------------------------
// Storage URL → internal path helper
// -------------------------------
function extractStoragePathFromPublicUrl(publicUrl) {
  // Expects: https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>
  const marker = "/storage/v1/object/public/";
  const i = publicUrl.indexOf(marker);
  if (i === -1) return null;
  const after = publicUrl.slice(i + marker.length); // e.g. chat-images/clubId/userId/file.jpg
  const firstSlash = after.indexOf("/");
  return firstSlash === -1 ? null : after.slice(firstSlash + 1); // strip bucket name
}


