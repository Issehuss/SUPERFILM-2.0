// src/components/JoinClubButton.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "lib/supabaseClient";
import { requestToJoinClub } from "../utils/membershipRequests";
import { useMembershipRefresh } from "../context/UserContext";
import { hasRecentlyLeftClub } from "../lib/membershipCooldown";
import toast from "react-hot-toast";

/**
 * Props:
 * - club: { id, privacy_mode? }
 * - user: current user (or null)
 * - isMember: boolean (already a member)
 */
export default function JoinClubButton({ club, user, isMember }) {
  const navigate = useNavigate();
  const { bumpMembership } = useMembershipRefresh();

  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const inferredMode = club?.privacy_mode || "request"; // 'open' | 'request' | 'private'

  // Fetch latest request status for this user+club
  useEffect(() => {
    let mounted = true;
    let retryTimer;
    const loadStatus = async () => {
      const { data: auth } = await supabase.auth.getSession();
      const sessionUserId = auth?.session?.user?.id || null;
      const resolvedUserId = user?.id || sessionUserId;
      if (!resolvedUserId || !club?.id) {
        if (!resolvedUserId) retryTimer = setTimeout(loadStatus, 500);
        return;
      }

      const { data: memberRow, error: memberErr } = await supabase
        .from("club_members")
        .select("accepted")
        .eq("club_id", club.id)
        .eq("user_id", resolvedUserId)
        .maybeSingle();

      if (!mounted) return;
      if (!memberErr && memberRow) {
        setPending(false);
        setRequestId(null);
        bumpMembership();
        return;
      }

      const { data, error } = await supabase
        .from("membership_requests")
        .select("id,status")
        .eq("club_id", club.id)
        .eq("user_id", resolvedUserId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!mounted) return;
      if (!error && data) {
        setPending(data.status === "pending");
        setRequestId(data.id);
      } else {
        setPending(false);
        setRequestId(null);
      }
    };
    loadStatus();
    return () => {
      mounted = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [user?.id, club?.id, bumpMembership]);

  useEffect(() => {
    if (!club?.id || !user?.id) return undefined;
    const channel = supabase
      .channel(`membership-requests:${club.id}:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "membership_requests",
          filter: `club_id=eq.${club.id}`,
        },
        (payload) => {
          const row = payload?.new || payload?.old;
          if (!row || row.user_id !== user.id) return;
          const { id, status } = row;
          if (status === "pending") {
            setPending(true);
            setRequestId(id);
            return;
          }
          setPending(false);
          setRequestId(null);
          if (status === "approved") {
            setPending(false);
            setRequestId(null);
            bumpMembership();
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [club?.id, user?.id, bumpMembership]);

  if (!club) return null;

  // Not signed in -> prompt to auth
  if (!user?.id) {
    return (
      <button
        onClick={() => navigate("/auth")}
        className="px-3 py-1.5 rounded bg-yellow-500 text-black text-sm font-semibold hover:bg-yellow-400"
      >
        Sign in to Join
      </button>
    );
  }

  // Already a member -> no button
  if (isMember) return null;

  async function handleJoin() {
    if (hasRecentlyLeftClub(club?.id)) {
      toast.error("You recently left this club. Give it a few minutes before rejoining.");
      return;
    }
    setLoading(true);
    try {
      // Re-read privacy mode from DB in case it changed
      const { data: clubRow } = await supabase
        .from("clubs_public")
        .select("privacy_mode, slug")
        .eq("id", club.id)
        .maybeSingle();

      const privacyMode = clubRow?.privacy_mode || inferredMode;

      if (privacyMode === "open") {
        // Join immediately (idempotent; ignore duplicate constraint)
        const { error } = await supabase
          .from("club_members")
          .insert({ club_id: club.id, user_id: user.id, role: "member" });

        if (error && error.code !== "23505") throw error;

        bumpMembership();
        toast.success("Joined the club!");
        return;
      }

      // Request-gated (includes 'private'): use RPC upsert (atomic)
      await requestToJoinClub(club.id);
      setPending(true);
      toast.success("Join request sent!");
    } catch (e) {
      toast.error(e.message || "Unable to join right now.");
    } finally {
      setLoading(false);
    }
  }

  async function cancelRequest() {
    if (!requestId) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("membership_requests")
        .delete()
        .eq("id", requestId)
        .eq("status", "pending");

      if (error) throw error;

      setPending(false);
      setRequestId(null);
      toast.success("Request cancelled.");
    } catch (e) {
      toast.error(e.message || "Unable to cancel request.");
    } finally {
      setLoading(false);
    }
  }

  // Pending UI
  if (pending) {
    return (
      <div className="ml-auto flex items-center gap-2">
        <span className="text-sm text-zinc-400">Request sent</span>
        <button
          onClick={cancelRequest}
          disabled={loading}
          className="text-sm px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    );
  }

  // Default CTA
  return (
    <button
      onClick={handleJoin}
      disabled={loading}
      className="px-3 py-1.5 rounded bg-yellow-500 text-black text-sm font-semibold hover:bg-yellow-400 disabled:opacity-60"
    >
      {inferredMode === "open" ? "Join Club" : "Request to Join"}
    </button>
  );
}
