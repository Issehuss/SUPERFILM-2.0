// src/pages/ClubChat.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Users, Image as ImageIcon, X, Plus } from "lucide-react";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";
import MessageItem from "../components/MessageItem";
import PollComposer from "../components/polls/PollComposer";
import { toast } from "react-hot-toast";

const PAGE_SIZE = 50;
const CHAT_BUCKET = "chat-images";
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isTempMessage(m) {
  const id = String(m?.id || "");
  return id.startsWith("temp_") || !UUID_RX.test(id) || m._optimistic === true;
}

export default function ClubChat() {
  // Route params (support legacy id and new slug forms)
  const { clubId: legacyClubId } = useParams();
  const { clubParam } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();

  // Resolved club data
  const [clubId, setClubId] = useState(null);      // raw param if UUID
  const [clubRow, setClubRow] = useState(null);    // row from clubs (id, slug, name)
  const clubKey = (clubId || clubParam || "").trim();

  // Chat state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [online, setOnline] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  // Composer state
  const [imageFile, setImageFile] = useState(null);
  const [imageObjectUrl, setImageObjectUrl] = useState("");

  // Tools / polls
  const [showTools, setShowTools] = useState(false);
  const [showPollComposer, setShowPollComposer] = useState(false);

  // Reporting UI state (banner/spinner)
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState(null);

  // Refs
  const listRef = useRef(null);
  const composerRef = useRef(null);
  const presenceRef = useRef(null);

  

  const me = user?.id || null;

  // put this inside the ClubChat component (near other helpers/state)
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isTempMessage(m) {
  const id = String(m?.id || "");
  return id.startsWith("temp_") || !UUID_RX.test(id) || m._optimistic === true;
}


  /** Resolve initial route param into a UUID (handles slug or id) */
  useEffect(() => {
    const routeId = (clubParam ?? legacyClubId) || "";
    if (!routeId) return;

    const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_RX.test(routeId)) {
      setClubId(routeId);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("id, slug, name")
        .eq("slug", routeId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("Failed to load club by slug", error);
        return;
      }
      if (data?.id) setClubId(data.id);
    })();

    return () => {
      cancelled = true;
    };
  }, [clubParam, legacyClubId]);

  /** Fetch normalized club row by id or slug and normalize URL */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!clubKey) return;
      setLoading(true);

      const isUuid = /^[0-9a-f-]{10,}$/i.test(clubKey);
      const { data, error } = await (isUuid
        ? supabase.from("clubs").select("id, slug, name").eq("id", clubKey).maybeSingle()
        : supabase.from("clubs").select("id, slug, name").eq("slug", clubKey).maybeSingle());

      if (cancelled) return;

      if (error) console.error("Failed to resolve club:", error);
      if (data) {
        setClubRow(data);
        // If user hit /clubs/:id/chat instead of /clubs/:slug/chat, normalize:
        if (clubParam && data.slug && clubParam !== data.slug) {
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

  const resolvedClubId = clubRow?.id || clubId || null;

  /** Load messages (base) + hydrate profiles; subscribe to realtime insert/update */
  useEffect(() => {
    if (!resolvedClubId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);

      // 1) Base fetch (no joins): avoids RLS surprises
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
        if (!err2 && profs) {
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
      if (!cancelled && me) {
        await supabase.from("club_message_reads").upsert({
          club_id: resolvedClubId,
          user_id: me,
          last_read_at: new Date().toISOString(),
        });
      }
    })();

    // 4) Realtime subscribe (INSERT + UPDATE)
    const channel = supabase
      .channel(`club-chat:${resolvedClubId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "club_messages", filter: `club_id=eq.${resolvedClubId}` },
        async (payload) => {
          if (cancelled) return;
          const msg = payload.new;
          // hydrate profile best-effort
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, avatar_url, display_name, slug")
            .eq("id", msg.user_id)
            .maybeSingle();
          setMessages(prev => [...prev, { ...msg, profiles: profile || null }]);
          requestAnimationFrame(scrollToBottom);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "club_messages", filter: `club_id=eq.${resolvedClubId}` },
        (payload) => {
          if (cancelled) return;
          const updated = payload.new;
          setMessages(prev => prev.map(m => (m.id === updated.id ? { ...m, ...updated } : m)));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [resolvedClubId, me]);

  /** Presence (separate from chat changes) */
  useEffect(() => {
    if (!resolvedClubId) return;

    if (presenceRef.current) supabase.removeChannel(presenceRef.current);
    const presence = supabase.channel(`presence-club-${resolvedClubId}`, {
      config: { presence: { key: me || Math.random().toString(36).slice(2) } },
    });
    presence.on("presence", { event: "sync" }, () => {
      const members = Object.values(presence.presenceState() || {}).flat();
      setOnline(members.length);
    });
    presence.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presence.track({ at: Date.now(), uid: me || null });
      }
    });
    presenceRef.current = presence;

    return () => {
      if (presenceRef.current) supabase.removeChannel(presenceRef.current);
    };
  }, [resolvedClubId, me]);

  /** Admin role detection */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!resolvedClubId || !me) return;
      const { data } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", resolvedClubId)
        .eq("user_id", me)
        .maybeSingle();
      if (!cancelled) {
        const role = data?.role || "";
        setIsAdmin(["president", "admin", "moderator"].includes(role));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedClubId, me]);

  /** Group messages by day (for sticky headers) */
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

  async function insertMessage(row) {
    for (let i = 0; i < 2; i++) {
      const { data, error } = await supabase.from("club_messages")
        .insert([row]).select("id, created_at").single();
      if (!error) return { data };
      if (i === 1) return { error };
      await new Promise(r => setTimeout(r, 300)); // brief retry
    }
  }
  

  async function handleReportMessage({ message, clubId, reason = "abuse" }) {
    if (!message?.id || isTempMessage(message)) {
      toast.error("Please wait until the message finishes sending.");
      return;
    }
    if (!clubId) {
      toast.error("Club isn’t ready yet. Try again.");
      return;
    }
  
    // Show a success toast immediately (optimistic UX)
    const tid = toast.success("Report sent. We’ll review it.");
  
    // Fire the network request without blocking the UI
    const started = Date.now();
    const MIN_SPINNER_MS = 120;
  
    supabase.functions.invoke("notify-message2", {
      body: { messageId: message.id, clubId, reason },
    })
    .then(({ error, data }) => {
      // Keep toast; if duplicate or soft warnings, you can tweak here
      if (error) {
        toast.dismiss(tid);
        toast.error("Couldn’t send report.");
        console.error("report error:", error);
      }
    })
    .catch((e) => {
      toast.dismiss(tid);
      toast.error("Couldn’t send report.");
      console.error("report exception:", e);
    });
  }

  /** Input helpers */
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
  } catch {
    // ignore client check failures; server enforces anyway
  }

  // Clear input now (snappier UI)
  setInput("");

  // ✅ Optimistic UI — mark as _optimistic so we can tell it's not persisted yet
  const tempId = `temp_${Date.now()}`;
  const optimistic = {
    id: tempId,
    _optimistic: true,                 // ← add this flag
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

    // ✅ Replace optimistic with real id/timestamp and clear the flag
    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId
          ? { ...m, id: data.id, created_at: data.created_at, _optimistic: false }
          : m
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
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    setImageObjectUrl("");
    setImageFile(null);
    setSending(false);
  }
};


  /** Scroll helper */
  const scrollToBottom = () => {
    try {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });
    } catch {}
  };

  /** Delete message (soft) */
  async function handleDeleteMessage(msg) {
    if (!msg?.id) return;

    // Optimistic UI
    const previous = msg;
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, is_deleted: true, body: null, image_url: null } : m)));

    try {
      if (msg.image_url) {
        const path = extractStoragePathFromPublicUrl(msg.image_url);
        if (path) await supabase.storage.from(CHAT_BUCKET).remove([path]);
      }

      const { error } = await supabase
        .from("club_messages")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: me || null,
          body: null,
          image_url: null,
        })
        .eq("id", msg.id);

      if (error) throw error;
    } catch (e) {
      console.error(e);
      // rollback
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...previous } : m)));
      alert("Couldn’t delete message.");
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

      {/* Messages list */}
      <div ref={listRef} className="mx-auto max-w-3xl px-4 pb-[168px] pt-4">
        {loading && <div className="text-center text-zinc-400 py-12">Loading…</div>}

        {!loading && messages.length === 0 && (
          <div className="text-center text-zinc-400 py-12">Be the first to say hello 👋</div>
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
             // When rendering MessageItem in ClubChat.jsx
<MessageItem
  key={m.id}
  msg={m}
  isMe={m.user_id === me}
  isAdmin={isAdmin}
  onDelete={handleDeleteMessage}
  onReport={(reason) => handleReportMessage({ message: m, clubId: m.club_id, reason })}
  reportDisabled={isTempMessage(m)}   // <- new prop
/>

            

            )
          )}
      </div>

      {/* Composer – docked */}
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

            {/* Poll composer modal */}
            {showPollComposer && (
              <PollComposer
                clubId={resolvedClubId}
                onClose={() => setShowPollComposer(false)}
                onCreated={async (pollId, question) => {
                  try {
                    const { data: newMsg, error } = await supabase
                      .from("club_messages")
                      .insert({
                        club_id: resolvedClubId,
                        user_id: me,
                        body: `Poll: ${question}`,
                        type: "poll",
                        metadata: { poll_id: pollId },
                      })
                      .select(
                        "id, club_id, user_id, body, image_url, is_deleted, created_at, type, metadata"
                      )
                      .single();

                    if (error) throw error;

                    setMessages((prev) => [
                      ...prev,
                      {
                        ...newMsg,
                        profiles: {
                          id: me,
                          avatar_url: user?.profileAvatarUrl || null,
                          display_name: user?.name || null,
                          username: user?.username || null,
                        },
                      },
                    ]);
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

              {/* Tools menu */}
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
                disabled={(!input.trim() && !imageFile) || sending || !me}
                className="rounded-full w-10 h-10 shrink-0 grid place-items-center bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black"
                aria-label="Send"
              >
                <Send size={18} />
              </button>
            </div>

            <div className="text-[11px] text-zinc-500 mt-1 ml-1">
              Press <b>Enter</b> to send • <b>Shift+Enter</b> for a new line
              {reporting && <span className="ml-3">• Sending report…</span>}
              {reportError && <span className="ml-2 text-red-400">{reportError}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Helpers ------------------------------- */

// Upload helper (Supabase Storage)
async function uploadChatImage(file, clubId, userId) {
  const ext = (file.name?.split(".").pop() || "jpg").toLowerCase();
  const path = `${clubId}/${userId}/${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(CHAT_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (upErr) throw upErr;

  const publicUrl = supabase.storage.from(CHAT_BUCKET).getPublicUrl(path).data.publicUrl;
  return publicUrl;
}

// Client-side banned-words precheck (server trigger still enforces)
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
    return false; // fail-open on client
  }
}

// Storage public URL → internal path
function extractStoragePathFromPublicUrl(publicUrl) {
  const marker = "/storage/v1/object/public/";
  const i = publicUrl.indexOf(marker);
  if (i === -1) return null;
  const after = publicUrl.slice(i + marker.length);
  const firstSlash = after.indexOf("/");
  return firstSlash === -1 ? null : after.slice(firstSlash + 1);
}


