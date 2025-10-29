// src/components/AccountMenu.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import {
  LogOut,
  Settings,
  User as UserIcon,
  ChevronDown,
  KeySquare,
  BarChart3,
  Lock,
  Crown,
  CreditCard,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import useEntitlements from "../hooks/useEntitlements";
import DirectorsCutBadge from "./DirectorsCutBadge";

export default function AccountMenu({ className = "" }) {
  // Pull isPremium directly from UserContext for a single source of truth
  const { user, profile, avatar, logout, isPremium } = useUser();
  const { presidentsClubs } = useEntitlements();

  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const btnRef = useRef(null);

  const displayName = useMemo(
    () => profile?.display_name || user?.email?.split("@")[0] || "Me",
    [profile?.display_name, user?.email]
  );

  // choose an “active” president club (from localStorage, else first)
  const activeClubSlug =
    typeof window !== "undefined" ? localStorage.getItem("activeClubSlug") : null;
  const activeClubId =
    typeof window !== "undefined" ? localStorage.getItem("activeClubId") : null;

  const presidentClub =
    presidentsClubs.find(
      (c) =>
        (activeClubSlug && c.slug === activeClubSlug) ||
        (activeClubId && String(c.id) === String(activeClubId))
    ) || presidentsClubs[0] || null;

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!user) return null;

  /* ------- Actions ------- */
  const goProfile = () => {
    setOpen(false);
    const slug = profile?.slug || user?.id;
    if (slug) navigate(`/u/${slug}`);
  };

  const goClubSettings = () => {
    setOpen(false);
    if (!isPremium || !presidentClub) {
      navigate("/premium");
      return;
    }
    const path = presidentClub.slug
      ? `/clubs/${presidentClub.slug}/settings`
      : `/clubs/${presidentClub.id}/settings`;
    navigate(path);
  };

  const goManageInvites = () => {
    setOpen(false);
    if (!isPremium || !presidentClub) {
      navigate("/premium");
      return;
    }
    const path = presidentClub.slug
      ? `/clubs/${presidentClub.slug}/invites`
      : `/clubs/${presidentClub.id}/invites`;
    navigate(path);
  };

  const goAnalytics = () => {
    const enabled = isPremium && !!presidentClub;
    if (!enabled) return; // keep unclickable for non-eligible users
    setOpen(false);
    const path = presidentClub.slug
      ? `/clubs/${presidentClub.slug}/analytics`
      : `/clubs/${presidentClub.id}/analytics`;
    navigate(path);
  };

  const goPremiumManage = () => {
    setOpen(false);
    navigate(isPremium ? "/settings/premium" : "/premium");
  };

  const handleSignOut = async () => {
    setOpen(false);
    try {
      await logout();
      navigate("/");
    } catch (e) {
      console.error(e);
    }
  };

  const premiumEnabled = isPremium && !!presidentClub;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
        className="inline-flex items-center gap-2 rounded-full ring-1 ring-white/10 bg-white/10 hover:bg-white/15 px-2 py-1 transition"
      >
        <img
          src={profile?.avatar_url || avatar || "/avatars/default.jpg"}
          alt=""
          className="h-8 w-8 rounded-full object-cover"
          draggable={false}
        />
        <ChevronDown className="h-4 w-4 opacity-70" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 mt-2 w-64 rounded-2xl bg-black/90 backdrop-blur ring-1 ring-white/10 shadow-2xl origin-top-right"
          style={{ transformOrigin: "top right" }}
        >
          {/* header with username + Director’s Cut badge */}
          <div className="px-3 py-2">
            <div className="text-sm font-semibold truncate flex items-center">
              <span className="truncate">{displayName}</span>
              {isPremium && <DirectorsCutBadge className="ml-2" size="xs" />}
            </div>
            <div className="text-xs text-zinc-400 truncate">
              {profile?.slug ? `@${profile.slug}` : user?.email}
            </div>
          </div>

          <div className="h-px bg-white/10" />

          {/* Profile */}
          <button
            type="button"
            onClick={goProfile}
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 rounded-2xl"
          >
            <UserIcon className="h-4 w-4" />
            <span>My Profile</span>
          </button>

          {/* --- Premium entry (Step 5.3) --- */}
          <button
            type="button"
            onClick={goPremiumManage}
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 rounded-2xl"
            aria-label={isPremium ? "Manage Premium subscription" : "Go Premium"}
          >
            {isPremium ? (
              <>
                <CreditCard className="h-4 w-4" />
                <span>Manage Premium</span>
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-yellow-300/90">
                  <Crown className="h-3 w-3" />
                  Director’s Cut
                </span>
              </>
            ) : (
              <>
                <Crown className="h-4 w-4" />
                <span>Go Premium</span>
                <span className="ml-auto text-[11px] text-zinc-400">Director’s Cut</span>
              </>
            )}
          </button>

          {/* Premium president tools */}
          <div className="h-px bg-white/10 my-1" />

          <button
            type="button"
            onClick={goClubSettings}
            role="menuitem"
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-2xl ${
              premiumEnabled ? "hover:bg-white/10" : "opacity-60 hover:bg-white/5"
            }`}
            title={
              premiumEnabled
                ? "Club Settings"
                : "Director’s Cut required (or not a club president)"
            }
          >
            <Settings className="h-4 w-4" />
            <span>Club Settings</span>
          </button>

          <button
            type="button"
            onClick={goManageInvites}
            role="menuitem"
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-2xl ${
              premiumEnabled ? "hover:bg-white/10" : "opacity-60 hover:bg-white/5"
            }`}
            title={
              premiumEnabled
                ? "Create & manage invites"
                : "Director’s Cut required (or not a club president)"
            }
          >
            <KeySquare className="h-4 w-4" />
            <span>Manage Invites</span>
          </button>

          {/* Analytics (Director’s Cut) — disabled for non-premium or non-president */}
          <button
            type="button"
            onClick={goAnalytics}
            role="menuitem"
            aria-disabled={!premiumEnabled}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-2xl ${
              premiumEnabled
                ? "hover:bg-white/10"
                : "cursor-not-allowed opacity-60 hover:bg-white/5 pointer-events-none"
            }`}
            title={
              premiumEnabled
                ? "Open Analytics"
                : "Director’s Cut required (and must be a club president)"
            }
          >
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
            {!premiumEnabled && <Lock className="ml-auto h-4 w-4 opacity-70" />}
          </button>

          <div className="h-px bg-white/10 my-1" />

          <button
            type="button"
            onClick={handleSignOut}
            role="menuitem"
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 rounded-2xl"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
