// src/pages/ClubChat.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Users, Image as ImageIcon, X, Plus } from "lucide-react";
import supabase from "lib/supabaseClient";
import { useUser } from "../context/UserContext";
import MessageItem from "../components/MessageItem";
import PollComposer from "../components/polls/PollComposer";
import { toast } from "react-hot-toast";
import useRealtimeResume from "../hooks/useRealtimeResume";
import useSafeSupabaseFetch from "../hooks/useSafeSupabaseFetch";
import useAppResume from "../hooks/useAppResume";

const PAGE_SIZE = 50;
const CHAT_BUCKET = "chat-images";
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHAT_CACHE_TTL_MS = 5 * 60 * 1000;
const CHAT_CACHE_PREFIX = "sf.chat.cache.v1";
const AUTO_SCROLL_THRESHOLD = 180;

function isTempMessage(m) {
  const id = String(m?.id || "");
  return id.startsWith("temp_") || !UUID_RX.test(id) || m?._optimistic === true;
}

function MessageRowSkeleton({ alignRight = false }) {
  return (
    <div className={`flex items-start gap-3 ${alignRight ? "justify-end" : ""}`}>
      {!alignRight && <div className="h-9 w-9 rounded-full bg-zinc-800 animate-pulse" />}
      <div className={`flex flex-col space-y-2 ${alignRight ? "items-end" : ""} flex-1 max-w-[70%]`}>
        <div className="h-3 w-24 rounded bg-zinc-800 animate-pulse" />
        <div className="h-12 rounded-2xl bg-zinc-900/70 animate-pulse" />
      </div>
      {alignRight && <div className="h-9 w-9 rounded-full bg-zinc-800 animate-pulse" />}
    </div>
  );
}

function MessageListSkeleton() {
  return (
    <div className="space-y-4 py-6">
      <MessageRowSkeleton />
      <MessageRowSkeleton alignRight />
      <MessageRowSkeleton />
      <MessageRowSkeleton />
      <MessageRowSkeleton alignRight />
    </div>
  );
}

const memoryChatCache = new Map();

async function fetchProfileDisplays(ids) {
  const unique = Array.from(new Set((ids || []).filter(Boolean)));
  if (!unique.length) return {};
  const results = await Promise.all(
    unique.map(async (id) => {
      const { data, error } = await supabase.rpc("get_profile_display", {
        p_user_id: id,
      });
      if (error || !data) return null;
      return [id, { ...data, id }];
    })
  );
  const map = {};
  results.forEach((pair) => {
    if (pair) map[pair[0]] = pair[1];
  });
  return map;
}

function readChatCache(clubId) {
  if (!clubId) return null;
  const mem = memoryChatCache.get(clubId);
  if (mem && Date.now() - mem.ts < CHAT_CACHE_TTL_MS) return mem.data;
  try {
    const raw = sessionStorage.getItem(`${CHAT_CACHE_PREFIX}:${clubId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !Array.isArray(parsed?.data)) return null;
    if (Date.now() - parsed.ts > CHAT_CACHE_TTL_MS) return null;
    memoryChatCache.set(clubId, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

function writeChatCache(clubId, data) {
  if (!clubId || !Array.isArray(data)) return;
  const payload = { ts: Date.now(), data: data.slice(-200) };
  memoryChatCache.set(clubId, payload);
  try {
    sessionStorage.setItem(`${CHAT_CACHE_PREFIX}:${clubId}`, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export default function ClubChat() {

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("debug_auth_uid");
      console.log("auth.uid seen by db:", data, error);
    })();
  }, []);
  
  // Route params (support legacy id and new slug forms)
  const { clubId: legacyClubId, clubParam } = useParams();
  const navigate = useNavigate();
  const { user, profile, sessionLoaded } = useUser();

  // Resolved club data
  const [clubRow, setClubRow] = useState(null);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  
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
  const [reporting] = useState(false);
  const [reportError] = useState(null);
  const [profilesCache, setProfilesCache] = useState({});
  const [memberCount, setMemberCount] = useState(null);

  const selfProfile = useMemo(() => {
    if (!user?.id) return null;
    return {
      id: user.id,
      avatar_url: profile?.avatar_url || "/default-avatar.svg",
      display_name: profile?.display_name || profile?.username || null,
      slug: profile?.slug || null,
    };
  }, [user?.id, profile?.avatar_url, profile?.display_name, profile?.username, profile?.slug]);

  // Seed cache with self profile for instant avatar on send
  useEffect(() => {
    if (selfProfile?.id) {
      setProfilesCache((prev) =>
        prev[selfProfile.id] ? prev : { ...prev, [selfProfile.id]: selfProfile }
      );
    }
  }, [selfProfile]);


  // Refs
  const listRef = useRef(null);
  const composerRef = useRef(null);
  const presenceRef = useRef(null);
  const autoScrollAllowedRef = useRef(true);
  const ENABLE_PRESENCE = false;
  const resumeTick = useRealtimeResume();
  const appResumeTick = useAppResume();
  const lastReadAtRef = useRef(null);
  const [lastReadAt, setLastReadAt] = useState(null);

  const me = user?.id || null;
  // NEW loading flags
const [resolvingClub, setResolvingClub] = useState(true); // slug/id → club row
const [loadingMsgs, setLoadingMsgs] = useState(true);     // message fetch


useEffect(() => {
  let cancelled = false;
  const routeKey = ((clubParam ?? legacyClubId) || "").trim();

  if (!routeKey) {
    setResolvingClub(false);
    return;
  }

  setResolvingClub(true);
  (async () => {
    const isUuid = UUID_RX.test(routeKey);
    const { data, error } = await supabase
      .from("clubs_public")
      .select("id, slug, name")
      .eq(isUuid ? "id" : "slug", routeKey)
      .maybeSingle();

    if (cancelled) return;

    if (data?.id) {
      setClubRow(data);
      // Normalize URL if user used /clubs/:id/chat instead of /clubs/:slug/chat
      if (!isUuid && clubParam && data.slug && clubParam !== data.slug) {
        navigate(`/clubs/${data.slug}/chat`, { replace: true });
      }
    } else {
      console.warn("[Chat] resolve club failed:", error?.message || error);
    }

    setResolvingClub(false);
  })();

  return () => { cancelled = true; };
}, [clubParam, legacyClubId, navigate]);
 


 

  /** Fetch normalized club row by id or slug and normalize URL */
 

  const resolvedClubId = clubRow?.id || null;

  useEffect(() => {
    if (!resolvedClubId) {
      setMemberCount(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { count, error } = await supabase
          .from("club_members")
          .select("id", { count: "exact", head: true })
          .eq("club_id", resolvedClubId)
          .eq("accepted", true);
        if (cancelled) return;
        if (error) {
          console.warn("[ClubChat] member count fetch failed:", error.message || error);
          setMemberCount(null);
          return;
        }
        setMemberCount(typeof count === "number" ? count : null);
      } catch (err) {
        if (!cancelled) {
          console.warn("[ClubChat] member count exception:", err);
          setMemberCount(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedClubId]);

  useEffect(() => {
    if (!ENABLE_PRESENCE) return;
    if (!resolvedClubId) return;
    if (!messages?.length) return;
    writeChatCache(resolvedClubId, messages);
  }, [messages, resolvedClubId]);


  useEffect(() => {
    if (!resolvedClubId) {
      setLoadingMsgs(false);
      return;
    }
    const cached = readChatCache(resolvedClubId);
    if (cached?.length) {
      setMessages(cached);
    }
  }, [resolvedClubId]);

  useEffect(() => {
    if (!resolvedClubId || !sessionLoaded) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("club_message_reads")
        .select("last_read_at")
        .eq("club_id", resolvedClubId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error("[ClubChat] read cursor fetch failed:", error);
        return;
      }
      const readAt = data?.last_read_at || null;
      lastReadAtRef.current = readAt;
      setLastReadAt(readAt);
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedClubId, sessionLoaded]);

  const {
    data: chatResult,
    loading: chatLoading,
    error: chatError,
    timedOut: chatTimedOut,
  } = useSafeSupabaseFetch(
    async () => {
      if (!resolvedClubId) throw new Error("no-club");
      const { data: rows, error: err1 } = await supabase
        .from("club_messages")
        .select("id, club_id, user_id, body, image_url, is_deleted, created_at, type, metadata")
        .order("created_at", { ascending: true })
        .limit(PAGE_SIZE);
      if (err1) throw err1;

      const uniqueUserIds = [...new Set((rows || []).map(r => r.user_id).filter(Boolean))];
      let profileMap = {};
      if (uniqueUserIds.length) {
        const missing = uniqueUserIds.filter((id) => !profilesCache[id]);
        const fetched = missing.length ? await fetchProfileDisplays(missing) : {};
        profileMap = { ...profilesCache, ...fetched };
      }

      const hydrated = (rows || []).map(r => ({ ...r, profiles: profileMap[r.user_id] || null }));
      return { messages: hydrated, profileMap };
    },
    [resolvedClubId, profilesCache, appResumeTick, sessionLoaded],
    { enabled: Boolean(resolvedClubId && sessionLoaded), timeoutMs: 8000 }
  );

  useEffect(() => {
    setLoadingMsgs(chatLoading);
  }, [chatLoading]);

  useEffect(() => {
    if (!chatResult) return;
    setProfilesCache(chatResult.profileMap || {});
    setMessages(chatResult.messages || []);
    writeChatCache(resolvedClubId, chatResult.messages || []);
  
    // Only auto-scroll on first load
    if (!listRef.current) return;
    const el = listRef.current;
    const atBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < AUTO_SCROLL_THRESHOLD;
  
    if (atBottom) {
      requestAnimationFrame(() => scrollToBottom());
    }
  }, [chatResult, resolvedClubId]);
  

  useEffect(() => {
    if (chatError && chatError.message !== "no-club") {
      console.error("[Chat] fetch messages error:", chatError);
      setLoadingMsgs(false);
    }
  }, [chatError]);

  useEffect(() => {
    if (chatTimedOut) {
      setLoadingMsgs(false);
    }
  }, [chatTimedOut]);

  const getSessionUserId = useCallback(async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      if (error) {
        console.warn("[ClubChat] session fetch failed:", error.message);
      }
      if (!session?.user?.id) {
        console.warn("[unread] skipped – no session yet");
        return null;
      }
      return session.user.id;
    } catch (e) {
      console.warn("[ClubChat] session fetch exception:", e?.message || e);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!sessionLoaded || !resolvedClubId) return;
    if (!chatResult?.messages?.length) return;

    let cancelled = false;

    (async () => {
      const sessionUserId = await getSessionUserId();
      if (!sessionUserId) return;
      try {
        const readAt = new Date().toISOString();
        await supabase.from("club_message_reads").upsert({
          club_id: resolvedClubId,
          last_read_at: readAt,
        });
        lastReadAtRef.current = readAt;
        setLastReadAt(readAt);
      } catch (e) {
        if (!cancelled) {
          console.error("[ClubChat] mark read failed:", e?.message || e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chatResult, resolvedClubId, sessionLoaded, getSessionUserId]);

  // 4) Realtime subscribe after initial load
  useEffect(() => {
    if (!resolvedClubId) return;
    const channel = supabase
      .channel(`club-chat:${resolvedClubId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "club_messages", filter: `club_id=eq.${resolvedClubId}` },
        async (payload) => {
          const msg = payload.new;
          const cachedProfile = profilesCache[msg.user_id];
          let profile = cachedProfile;
          if (!profile) {
            const { data: prof, error } = await supabase.rpc("get_profile_display", {
              p_user_id: msg.user_id,
            });
            profile = error ? null : prof || null;
            if (profile) {
              setProfilesCache((prev) => ({ ...prev, [msg.user_id]: { ...profile, id: msg.user_id } }));
            }
          }
          setMessages(prev => [...prev, { ...msg, profiles: profile || null }]);
          requestAnimationFrame(() => scrollToBottom());
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "club_messages", filter: `club_id=eq.${resolvedClubId}` },
        (payload) => {
          const updated = payload.new;
          setMessages(prev => prev.map(m => (m.id === updated.id ? { ...m, ...updated } : m)));
        }
      )
      .subscribe();
  
    return () => {
      supabase.removeChannel(channel);
    };
  }, [resolvedClubId, profilesCache]);
  
  /** Presence (separate from chat changes) */
  useEffect(() => {
    if (!ENABLE_PRESENCE) return;
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
  }, [resolvedClubId, me, ENABLE_PRESENCE, resumeTick]);

  /** Admin role detection */
  const { data: adminRoleRow, error: adminRoleError } = useSafeSupabaseFetch(
    async () => {
      if (!resolvedClubId || !me) throw new Error("no-scope");
      const { data, error } = await supabase
        .from("club_members")
        .select("club_id, user_id, role, joined_at, accepted")
        .eq("club_id", resolvedClubId)
        .eq("user_id", me)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    },
    [resolvedClubId, me, appResumeTick],
    { enabled: Boolean(resolvedClubId && me), timeoutMs: 8000, initialData: null }
  );

  useEffect(() => {
    if (adminRoleRow) {
      const role = adminRoleRow?.role || "";
      setIsAdmin(["president", "admin", "moderator", "vice_president"].includes(role));
      return;
    }
    if (adminRoleError && adminRoleError.message !== "no-scope") {
      setIsAdmin(false);
    }
  }, [adminRoleRow, adminRoleError]);

  /** Group messages by day (for sticky headers) */
  const grouped = useMemo(() => {
    const out = [];
    let lastDay = "";
    let unreadInserted = false;
    const lastReadTs = lastReadAt ? new Date(lastReadAt).getTime() : null;
    (messages || []).forEach((m) => {
      const ts = new Date(m.created_at).getTime();
      if (
        lastReadTs &&
        !unreadInserted &&
        ts > lastReadTs &&
        m.user_id !== me
      ) {
        out.push({ _type: "unread", id: "unread-divider" });
        unreadInserted = true;
      }

      const day = new Date(m.created_at).toLocaleDateString();
      if (day !== lastDay) {
        out.push({ _type: "day", id: `d_${day}`, label: day });
        lastDay = day;
      }
      out.push(m);
    });
    return out;
  }, [messages, me, lastReadAt]);

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
    const tid = toast.success("Report sent. We’ll review it.");
  try {
    if (!supabase.functions?.invoke) {
      throw new Error("Server function not available.");
    }
    const { error } = await supabase.functions.invoke("notify-message2", {
      body: { messageId: message.id, clubId, reason },
    });
    if (error) {
      toast.dismiss(tid);
      toast.error("Couldn’t send report.");
      console.error("report error:", error);
    }
  } catch (e) {
    toast.dismiss(tid);
    toast.error("Couldn’t send report.");
    console.error("report exception:", e);
  }
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
    const objectUrl = URL.createObjectURL(file);
    setImageFile(file);
    setImageObjectUrl(objectUrl);
  };

  const clearPickedImage = () => {
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    setImageObjectUrl("");
    setImageFile(null);
  };

  // --------- sending (text + optional image)
  const send = async () => {
    if (!resolvedClubId || !me || sending || !sessionLoaded) {
      if (!sessionLoaded) {
        console.warn("[ClubChat] send skipped – session still loading");
      }
      return;
    }

    const body = (input || "").trim();
    const hasImage = !!imageFile;
    if (!body && !hasImage) return;

    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) {
      console.warn("[ClubChat] send aborted – session missing");
      return;
    }
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

    // Optimistic UI
    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      id: tempId,
      _optimistic: true,
      club_id: resolvedClubId,
      user_id: sessionUserId,
      body: body || "",
      image_url: imageObjectUrl || null,
      created_at: new Date().toISOString(),
      profiles: selfProfile,
      type: hasImage ? "image" : "text",
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom({ force: true });

    let uploadedImageUrl = null;
    try {
      // Upload image first (if any)
      if (hasImage) {
        uploadedImageUrl = await uploadChatImage(imageFile, resolvedClubId, sessionUserId);
      }

      // Insert the real row
    const { data, error } = await supabase
      .from("club_messages")
      .insert([
        {
          club_id: resolvedClubId,
          user_id: sessionUserId,
          body: body || "",
          image_url: uploadedImageUrl,
        },
      ])
        .select("id, created_at")
        .single();

      if (error) throw error;

      // Replace optimistic with real id/timestamp and clear the flag
      // Replace optimistic with real id/timestamp and clear the flag
setMessages((prev) =>
  prev.map((m) =>
    m.id === tempId
      ? { ...m, id: data.id, created_at: data.created_at, _optimistic: false }
      : m
  )
);

      if (!sessionUserId) {
        console.warn("[ClubChat] send skipped – session missing before unread update");
        return;
      }

      // Mark sender as read
      await supabase.from("club_message_reads").upsert({
        club_id: resolvedClubId,
        last_read_at: new Date().toISOString(),
      });

      // 🔐 Increment unread counts for other club members (server-side)
      await supabase.rpc("increment_club_unreads", {
        p_club_id: resolvedClubId,
        p_sender_id: sessionUserId,
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

  const evaluateAutoScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) {
      autoScrollAllowedRef.current = true;
      return;
    }
    const distanceFromBottom = Math.max(
      0,
      el.scrollHeight - el.scrollTop - el.clientHeight
    );
    autoScrollAllowedRef.current = distanceFromBottom <= AUTO_SCROLL_THRESHOLD;
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    evaluateAutoScroll();
    const handleScroll = () => evaluateAutoScroll();
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, [evaluateAutoScroll]);

  const scrollToBottom = useCallback(({ force = false } = {}) => {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = Math.max(
      0,
      el.scrollHeight - el.scrollTop - el.clientHeight
    );
    if (!force && distanceFromBottom > AUTO_SCROLL_THRESHOLD) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    autoScrollAllowedRef.current = true;
  }, []);

  /** DELETE (hard) — optimistic UI + RPC + optional storage cleanup */
 // inside ClubChat.jsx
async function handleDeleteMessage(arg) {
  const msg = typeof arg === "string" ? messages.find(m => m.id === arg) : arg;
  const id = typeof arg === "string" ? arg : arg?.id;
  if (!id) return;

  // Optimistic: remove from UI
  setMessages((prev) => prev.filter((m) => m.id !== id));

  try {
    // Try to remove image from storage (best effort)
      if (msg?.image_url) {
        const path = extractStoragePathFromPublicUrl(msg.image_url);
        if (path) {
          await supabase.storage.from(CHAT_BUCKET).remove([path]);
        }
      }

    // Hard delete via RPC
    const { data, error } = await supabase.rpc("delete_club_message_hard", {
      p_message: id,
    });

    if (error || !data?.ok) {
      throw new Error(error?.message || data?.code || "RPC failed");
    }
  } catch (e) {
    // ✅ Soft-recover: if it’s already gone on the server, keep UI silent
    try {
      const { count, error: headErr } = await supabase
        .from("club_messages")
        .select("id", { count: "exact", head: true })
        .eq("id", id);

      if (!headErr && (count === 0 || count == null)) {
        // Already deleted server-side; do nothing
        return;
      }
    } catch {
      // fall through to alert below
    }

    // Couldn’t delete; refetch the page and notify
    try {
      const { data: rows } = await supabase
        .from("club_messages")
        .select("id, club_id, user_id, body, image_url, is_deleted, created_at, type, metadata")
        .eq("club_id", clubRow?.id)
        .order("created_at", { ascending: true })
        .limit(50);

      const filtered = (rows || []).filter(r => r.is_deleted !== true);
      setMessages(filtered);
    } catch {}
    alert(e?.message || "Couldn't delete message.");
  }
}


  return (
    <div className="flex flex-col h-[calc(100vh-88px)] bg-gradient-to-b from-black via-zinc-950 to-black">
      {/* Header */}
      <div className="sticky top-0 z-10 px-6 lg:px-12 pt-4">
        <div
          className="rounded-2xl border border-zinc-800 backdrop-blur px-4 py-3 flex items-center gap-3 bg-gradient-to-b from-yellow-500/10 via-black/60 to-black"
          style={{ backgroundBlendMode: "multiply" }}
        >
          <button
            onClick={() => navigate(-1)}
            className="rounded-full bg-zinc-900 hover:bg-zinc-800 p-1.5 border border-zinc-800"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full overflow-hidden border border-zinc-700 bg-zinc-900 shrink-0">
                {clubRow?.profile_image_url ? (
                  <img
                    src={clubRow.profile_image_url}
                    alt={clubRow?.name || "Club"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-zinc-500 text-xs">
                    🎬
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{clubRow?.name || "Club Chat"}</div>
                <div className="text-xs text-zinc-400">
                  {memberCount != null ? `${memberCount} members` : "Club chat"}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Users size={14} />
            <span>{online} online</span>
          </div>
        </div>
      </div>

      {/* Messages list */}
      <div
        ref={listRef}
        className="hide-scrollbar flex-1 overflow-y-auto overscroll-contain px-6 lg:px-12 pt-4 pb-36 [-webkit-overflow-scrolling:touch]"
      >
        {(resolvingClub || loadingMsgs) && <MessageListSkeleton />}

        {!resolvingClub && !loadingMsgs && messages.length === 0 && (
          <div className="text-center text-zinc-400 py-12">Be the first to say hello 👋</div>
        )}

        {!resolvingClub &&
          !loadingMsgs &&
          grouped.map((m) =>
            m._type === "unread" ? (
              <div key={m.id} className="my-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-xs text-yellow-400 font-medium">
                  Unread messages
                </span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>
            ) : m._type === "day" ? (
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
                onDelete={() => handleDeleteMessage(m)} // pass the whole message
                onReport={(reason) =>
                  handleReportMessage({ message: m, clubId: m.club_id, reason })
                }
                reportDisabled={isTempMessage(m)}
              />
            )
          )}
      </div>

      {/* Composer – docked */}
      <div className="fixed bottom-0 left-0 right-0 z-30 pb-[env(safe-area-inset-bottom)] bg-gradient-to-t from-black via-black/80 to-transparent">
        <div className="px-6 lg:px-12 pb-4 pointer-events-auto flex justify-center">
          <div className="w-full max-w-[50%] min-w-[320px]">
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
                    const tempId = `temp_poll_${Date.now()}`;
                    const optimistic = {
                      id: tempId,
                      _optimistic: true,
                      club_id: resolvedClubId,
                      user_id: me,
                      body: `Poll: ${question}`,
                      image_url: null,
                      created_at: new Date().toISOString(),
                      type: "poll",
                      metadata: { poll_id: pollId },
                      profiles: selfProfile,
                    };
                    setMessages((prev) => [...prev, optimistic]);
                    requestAnimationFrame(() => scrollToBottom({ force: true }));

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
                        ...prev.filter((m) => m.id !== tempId),
                        { ...newMsg, profiles: selfProfile },
                      ]);
                    requestAnimationFrame(() => scrollToBottom({ force: true }));
                  } catch (e) {
                    console.error("Poll insert failed:", e);
                    setMessages((prev) => prev.filter((m) => !String(m.id).startsWith("temp_poll_")));
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
                disabled={(!input.trim() && !imageFile) || sending || !me || !sessionLoaded}
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
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // 🚫 not authenticated yet — skip client-side filter
    if (!session?.user?.id) return false;

    const { data, error } = await supabase.from("banned_words").select("pattern");
    if (error || !data) return false;

    for (const { pattern } of data) {
      try {
        if (new RegExp(pattern, "i").test(text)) return true;
      } catch {}
    }

    return false;
  } catch {
    return false;
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
