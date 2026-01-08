// src/pages/UserProfile.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import supabase from "../supabaseClient";
import { fetchActiveScheme } from "../lib/ratingSchemes";
import RatingSchemeView from "../components/RatingSchemeView";
import DirectorsCutBadge from "../components/DirectorsCutBadge";
import { useUser } from "../context/UserContext";
import StatsAndWatchlist from "../components/StatsAndWatchlist";
import ClubBadge from "../components/ClubBadge";
import FollowButton from "../components/FollowButton.jsx";
import AvatarCropper from "../components/AvatarCropper";
import Moodboard from "../components/Moodboard.jsx";
import EditProfilePanel from "../components/EditProfilePanel";
import { getThemeVars } from "../theme/profileThemes";
import ProfileTasteCards from "../components/ProfileTasteCards";
import FilmTakeCard from "../components/FilmTakeCard.jsx";
import uploadAvatar from "../lib/uploadAvatar";



const PROFILE_CACHE_TTL = 1000 * 60 * 5; // 5 minutes
const profileCacheKey = (id) => `sf.profile.cache.v1:${id}`;

const readProfileCache = (id) => {
  if (!id) return null;
  try {
    const raw = localStorage.getItem(profileCacheKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !parsed?.data) return null;
    if (Date.now() - parsed.ts > PROFILE_CACHE_TTL) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeProfileCache = (id, data) => {
  if (!id || !data) return;
  try {
    localStorage.setItem(
      profileCacheKey(id),
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {
    // ignore storage errors (e.g., private mode)
  }
};

// --- Local profile loader (slug or UUID) ---
const UUID_RX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadAnyProfileLocal(identifier) {
  if (!identifier) return null;

  try {
    if (UUID_RX.test(String(identifier))) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", identifier)
        .maybeSingle();
      if (error) throw error;
      return data || null;
    }

    // Try slug first (legacy), then username as a fallback
    const { data: bySlug, error: slugErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("slug", String(identifier))
      .maybeSingle();

    if (bySlug) return bySlug;
    if (slugErr) console.warn("[loadAnyProfileLocal] slug lookup failed:", slugErr.message);

    const { data: byUsername, error: usernameErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", String(identifier))
      .maybeSingle();
    if (usernameErr) throw usernameErr;
    return byUsername || null;
  } catch (e) {
    console.error("[loadAnyProfileLocal] failed:", e);
    return null;
  }
}


/* ---------------- small helpers ---------------- */
function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return d.toLocaleDateString();
}

function Stars5({ value = 0, size = 14 }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;

  const Star = ({ filled }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={filled ? "text-yellow-400" : "text-zinc-600"}
    >
      <path
        fill="currentColor"
        d="M12 17.3l-6.16 3.6 1.64-6.98L2 8.9l7.04-.6L12 1.8l2.96 6.5 7.04.6-5.48 5.02 1.64 6.98z"
      />
    </svg>
  );

  const Half = () => (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <defs>
        <linearGradient id="half">
          <stop offset="50%" stopColor="rgb(250 204 21)" />
          <stop offset="50%" stopColor="rgb(82 82 91)" />
        </linearGradient>
      </defs>
      <path
        fill="url(#half)"
        d="M12 17.3l-6.16 3.6 1.64-6.98L2 8.9l7.04-.6L12 1.8l2.96 6.5 7.04.6-5.48 5.02 1.64 6.98z"
      />
    </svg>
  );

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`f${i}`} filled />
      ))}
      {half ? <Half key="h" /> : null}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e${i}`} filled={false} />
      ))}
    </div>
  );
}

function ClubTakeItem({ t, showUser = false, canEdit = false, onRemove }) {
  const poster = t.movie?.poster || t.movie_poster || t.poster || null;
  const title = t.movie?.title || t.movie_title || t.title || "Untitled";
  const year = t.movie?.year ?? t.movie_year ?? null;

  const rating5 =
    typeof t.rating_5 === "number"
      ? t.rating_5
      : typeof t.rating === "number"
      ? t.rating
      : null;

  const clubName = t.club?.name || t.club_name || null;
  const clubSlug = t.club?.slug || t.club_slug || null;
  const clubId = t.club?.id || t.club_id || null;
  const clubHref = clubSlug ? `/clubs/${clubSlug}` : clubId ? `/clubs/${clubId}` : "#";

  return (
    <li className="group rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 hover:bg-zinc-900/60 transition">
      <div className="flex items-start gap-3">
        {poster ? (
          <img
            src={poster}
            alt={title}
            className="h-16 w-12 rounded-md object-cover border border-zinc-800"
            loading="lazy"
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="text-sm text-zinc-300">
            {showUser && t.user?.name ? (
              <span className="font-semibold text-white">{t.user.name}</span>
            ) : (
              <span className="font-semibold text-white">You</span>
            )}{" "}
            contributed to{" "}
            {clubName ? (
              <a href={clubHref} className="font-semibold text-white hover:underline">
                {clubName}
              </a>
            ) : (
              <span className="font-semibold text-white">a club</span>
            )}
            ’s review of <span className="font-semibold text-white">{title}</span>
            {year ? <span className="text-zinc-500"> ({year})</span> : null}
          </div>

          <div className="mt-1 flex items-center gap-3">
            {typeof rating5 === "number" ? (
              <div className="flex items-center gap-2">
                <Stars5 value={rating5} />
                <span className="text-xs text-zinc-400">{rating5}/5</span>
              </div>
            ) : null}

            {typeof t.club_avg_5 === "number" ? (
              <span className="text-xs text-zinc-400">Club avg {t.club_avg_5}/5</span>
            ) : null}

            {t.contributors > 1 ? (
              <span className="text-xs rounded-full bg-white/10 px-2 py-0.5">
                {t.contributors} contributors
              </span>
            ) : null}

            <span className="ml-auto text-xs text-zinc-500">
              {timeAgo(t.created_at || t.updated_at || new Date().toISOString())}
            </span>
          </div>

          {t.blurb ? (
            <p className="mt-2 text-sm text-zinc-200 line-clamp-3">{t.blurb}</p>
          ) : null}

          {canEdit && (
            <div className="mt-2 flex justify-end">
              <button onClick={onRemove} className="text-xs text-zinc-400 hover:text-red-400">
                remove
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

/* ============================ PAGE ============================ */
const UserProfile = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { slug: routeSlug, id: routeId } = useParams();
  const {
    user,
    profile,
    setAvatar,
    saveProfilePatch,
    loading,
  } = useUser();
  

  // this is the profile we actually render (could be me, could be someone else)
  const [viewProfile, setViewProfile] = useState(null);
  const [viewLoading, setViewLoading] = useState(true);

  // View vs edit
  const [editMode, setEditMode] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Avatar editing
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  // Banner overrides (local only)
  const [bannerOverride, setBannerOverride] = useState(null);
  const [bannerGradientOverride, setBannerGradientOverride] = useState(null);

  // Taste cards live state
  const [liveTasteCards, setLiveTasteCards] = useState(
    Array.isArray(profile?.taste_cards) ? profile.taste_cards : []
  );
  const [liveGlobalGlow, setLiveGlobalGlow] = useState(
    profile?.taste_card_style_global ?? null
  );

  // Premium rating scheme (view mode)
  const [viewScheme, setViewScheme] = useState(null);

  // Editing buffer
  const [editingTasteCards, setEditingTasteCards] = useState([]);

  // role / club / followers
  const [roleBadge, setRoleBadge] = useState(null);
  const [roleClub, setRoleClub] = useState(null);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });

    // Film takes (from Supabase table)
    
    const [filmTakesLoading, setFilmTakesLoading] = useState(true);
      // Film takes (loaded from Supabase)
  const [filmTakes, setFilmTakes] = useState([]);

    // Editing a single take (owner only)
    const [editingTake, setEditingTake] = useState(null);
  const [editingTakeDraft, setEditingTakeDraft] = useState({
      rating_5: 0,
      take: "",
    });
    const [editingTakeSaving, setEditingTakeSaving] = useState(false);

  // Avatar cropper state
  const [showAvatarCropper, setShowAvatarCropper] = useState(false);
  const [rawAvatarImage, setRawAvatarImage] = useState(null);
  


  

  // anchor for Moodboard
  const moodboardAnchorRef = useRef(null);

  /* =========================================================
     1. Decide whose profile to show (me vs /u/:slug vs /profile/:id)
     ========================================================= */
  useEffect(() => {
    let mounted = true;

    (async () => {
      setViewLoading(true);
      const identifier = routeSlug || routeId || null;

      // No identifier in URL → show my own profile
      if (!identifier) {
        setViewProfile(profile || null);
        setViewLoading(false);
        return;
      }

      // If identifier matches my own profile → also use current profile
      if (
        profile?.id === identifier ||
        (profile?.slug && profile.slug === identifier) ||
        (profile?.username && profile.username === identifier)
      ) {
        setViewProfile(profile);
        setViewLoading(false);
        return;
      }

      // Otherwise fetch that user
      // 1) show cached profile instantly (if fresh)
      const cached = readProfileCache(identifier);
      if (cached && mounted) {
        setViewProfile(cached);
        setViewLoading(false);
      }

      // 2) revalidate in background
      const fetched = await loadAnyProfileLocal(identifier);
      if (mounted) {
        if (fetched) writeProfileCache(identifier, fetched);
        setViewProfile(fetched);
        setViewLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [routeSlug, routeId, profile?.id, profile?.slug]);


  /* =========================================================
     2. Keep live taste cards in sync when actual profile changes
     ========================================================= */
  useEffect(() => {
    setLiveTasteCards(
      Array.isArray(viewProfile?.taste_cards) ? viewProfile.taste_cards : []
    );
  }, [viewProfile?.taste_cards]);

  useEffect(() => {
    setLiveGlobalGlow(viewProfile?.taste_card_style_global ?? null);
  }, [viewProfile?.taste_card_style_global]);

  useEffect(() => {
    function onTasteCardsUpdated(e) {
      if (Array.isArray(e?.detail?.cards)) {
        setLiveTasteCards(e.detail.cards);
      }
    }
    window.addEventListener("sf:tastecards:updated", onTasteCardsUpdated);
    return () => window.removeEventListener("sf:tastecards:updated", onTasteCardsUpdated);
  }, []);

  /* =========================================================
     3. Premium rating scheme for viewed profile
     ========================================================= */
  useEffect(() => {
    let mounted = true;
    async function loadScheme() {
      if (!viewProfile?.id) {
        if (mounted) setViewScheme(null);
        return;
      }
      try {
        const sch = await fetchActiveScheme(viewProfile.id);
        if (mounted) setViewScheme(sch);
      } catch {
        if (mounted) setViewScheme(null);
      }
    }
    loadScheme();
    return () => {
      mounted = false;
    };
  }, [viewProfile?.id]);

  // listen for updates from edit panel to refetch scheme
  useEffect(() => {
    function onSchemeUpdated() {
      if (!viewProfile?.id) return;
      fetchActiveScheme(viewProfile.id)
        .then((sch) => setViewScheme(sch))
        .catch(() => {});
    }
    window.addEventListener("sf:ratingscheme:updated", onSchemeUpdated);
    return () => window.removeEventListener("sf:ratingscheme:updated", onSchemeUpdated);
  }, [viewProfile?.id]);

  /* =========================================================
     4. Respect ?edit=true (open once, then clean URL)
     ========================================================= */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("edit") === "true") {
      setEditMode(true);
      setEditOpen(true);
      setEditingTasteCards(
        Array.isArray(viewProfile?.taste_cards) ? [...viewProfile.taste_cards] : []
      );
      params.delete("edit");
      navigate({ search: params.toString() }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, viewProfile?.taste_cards]);

  /* =========================================================
     5. Restore banner from localStorage (for own profile)
     ========================================================= */
  useEffect(() => {
    try {
      const ls = localStorage.getItem("userBanner");
      if (ls && !bannerOverride) setBannerOverride(ls);
    } catch {}
  }, [bannerOverride]);

  /* =========================================================
     6. Exit edit mode when panel broadcasts close
     ========================================================= */
  useEffect(() => {
    function handleExitEdit() {
      setEditOpen(false);
      setEditMode(false);
    }
    window.addEventListener("sf:editpanel:close", handleExitEdit);
    return () => window.removeEventListener("sf:editpanel:close", handleExitEdit);
  }, []);

  /* =========================================================
     7. Role pill + follow counts (for viewed profile)
     ========================================================= */
  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!viewProfile?.id) return;

      const { data: rolesRow } = await supabase
        .from("profile_roles")
        .select("roles")
        .eq("user_id", viewProfile.id)
        .maybeSingle();

      if (isMounted) {
        const roles = rolesRow?.roles || [];
        const top = roles?.[0] || null;
        setRoleBadge(top?.role || null);
        setRoleClub(
          top
            ? { club_slug: top.club_slug, club_name: top.club_name, club_id: top.club_id }
            : null
        );
      }

      const { data: fc } = await supabase
        .from("follow_counts")
        .select("followers, following")
        .eq("user_id", viewProfile.id)
        .maybeSingle();

      if (isMounted && fc) setCounts(fc);
    })();
    return () => {
      isMounted = false;
    };
  }, [viewProfile?.id]);

    /* =========================================================
     7b. Load film takes from Supabase (public)
     ========================================================= */
     useEffect(() => {
      let cancelled = false;
  
      async function loadTakes() {
        if (!viewProfile?.id) {
          if (!cancelled) {
            setFilmTakes([]);
            setFilmTakesLoading(false);
          }
          return;
        }
  
        setFilmTakesLoading(true);
        try {
          // Load unified Film Takes (from club_film_takes)
const { data, error } = await supabase
.from("club_film_takes")
.select("*")
.eq("user_id", viewProfile.id)
.eq("is_archived", false)
.order("created_at", { ascending: false });



  
          if (cancelled) return;
  
          if (error) {
            console.error("[film_takes] load error:", error);
            setFilmTakes([]);
          } else {
            setFilmTakes(
              Array.isArray(data)
                ? data.map((t) => ({
                    id: t.id,
                    user_id: t.user_id,
                    club_id: t.club_id,
                    film_id: t.film_id,
                    film_title: t.film_title,
title: t.film_title,      // <-- THIS fixes missing names in FilmTakeCard

                    text: t.take || t.text || "",
                    rating_5: typeof t.rating_5 === "number" ? t.rating_5 : t.rating || null,
                    aspect_key: t.aspect_key,
                    poster_path: t.poster_path,
                    created_at: t.created_at,
                    updated_at: t.updated_at,
                    screening_id: t.screening_id,
                  }))
                : []
            );
            
          }
        } catch (e) {
          if (!cancelled) {
            console.error("[film_takes] exception:", e);
            setFilmTakes([]);
          }
        } finally {
          if (!cancelled) setFilmTakesLoading(false);
        }
      }
  
      loadTakes();
      return () => {
        cancelled = true;
      };
    }, [viewProfile?.id]);
  

  /* =========================================================
     8. Navigate back to this profile after save
     ========================================================= */
  useEffect(() => {
    function onProfileSaved() {
      const path =
        (viewProfile?.slug && `/u/${viewProfile.slug}`) ||
        (viewProfile?.id && `/profile/${viewProfile.id}`) ||
        "/myprofile";

      navigate(path, { replace: true });
      setEditOpen(false);
      setEditMode(false);
    }

    window.addEventListener("sf:profile:saved", onProfileSaved);
    return () => window.removeEventListener("sf:profile:saved", onProfileSaved);
  }, [navigate, viewProfile?.slug, viewProfile?.id]);

  /* ---------------- handlers ---------------- */
  const viewingOwn =
    user?.id && viewProfile?.id ? user.id === viewProfile.id : true;

  const handleUsernameChange = async (newUsername) => {
    const lastChange = localStorage.getItem("usernameLastChanged");
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (!lastChange || now - Number(lastChange) > ninetyDays) {
      try {
        await saveProfilePatch({ slug: newUsername });
        localStorage.setItem("usernameLastChanged", String(now));
      } catch (e) {
        console.error("Failed to update username:", e);
      }
    } else {
      alert("You can only change your username once every 90 days.");
    }
  };

  const handleAvatarUpload = async (e) => {
    if (uploadingAvatar) return;
    const file = e.target.files?.[0];
    if (!file || !user?.id) {
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setRawAvatarImage(reader.result);
      setShowAvatarCropper(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handlePanelUpdated = async (patch) => {
    if (!patch) return;

    // Handle avatar uploads coming back from EditProfilePanel as data/blob URLs
    if (typeof patch.avatar_url === "string") {
      const src = patch.avatar_url;
      if ((src.startsWith("data:") || src.startsWith("blob:")) && user?.id) {
        try {
          const res = await fetch(src);
          const blob = await res.blob();
          const publicUrl = await uploadAvatar(blob, user.id, {
            prevUrl: viewProfile?.avatar_url || undefined,
          });
          patch = { ...patch, avatar_url: publicUrl };
          setAvatar(publicUrl);
          setViewProfile((prev) => (prev ? { ...prev, avatar_url: publicUrl } : prev));
        } catch (e) {
          console.error("Failed to persist avatar upload:", e);
          // If upload fails, drop the avatar change so we don't store a blob: URL in DB
          const { avatar_url, ...restPatch } = patch;
          patch = restPatch;
        }
      } else if (src.startsWith("data:") || src.startsWith("blob:")) {
        // Can't safely save a data/blob URL without a signed-in user
        const { avatar_url, ...restPatch } = patch;
        patch = restPatch;
      }
    }

    if (Object.prototype.hasOwnProperty.call(patch, "avatar_url")) {
      const nextAvatar = patch.avatar_url || null;
      setAvatar(nextAvatar || "/default-avatar.svg");
      setViewProfile((prev) => (prev ? { ...prev, avatar_url: nextAvatar } : prev));
    }

    if (typeof patch.banner_url === "string" && patch.banner_url) {
      setBannerOverride(patch.banner_url);
      try {
        localStorage.setItem("userBanner", patch.banner_url);
      } catch {}
    } else if (typeof patch.banner_image === "string" && patch.banner_image) {
      setBannerOverride(patch.banner_image);
      try {
        localStorage.setItem("userBanner", patch.banner_image);
      } catch {}
    }
    if (typeof patch.banner_gradient === "string") {
      setBannerGradientOverride(patch.banner_gradient);
    }

    if (Array.isArray(patch.taste_cards)) {
      setLiveTasteCards(patch.taste_cards);
      try {
        window.dispatchEvent(
          new CustomEvent("sf:tastecards:updated", { detail: { cards: patch.taste_cards } })
        );
      } catch {}
    }

    if (Object.prototype.hasOwnProperty.call(patch, "taste_card_style_global")) {
      setLiveGlobalGlow(patch.taste_card_style_global ?? null);
    }

    const { banner_url, banner_image, banner_gradient, taste_cards, ...rest } = patch;
    if (Object.keys(rest).length) {
      try {
        await saveProfilePatch(rest);
      } catch (e) {
        console.error("Failed to apply profile patch:", e);
      }
    }
  };

  const handleRemoveTake = async (id) => {
    if (!id) return;
    if (typeof window !== "undefined" && !window.confirm("Remove this take?")) return;

    try {
      const { error } = await supabase
      .from("club_film_takes")
        .delete()
        .eq("id", id)
        .eq("user_id", viewProfile?.id);

      if (error) throw error;

      // Update local state
      setFilmTakes((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error("Failed to remove take:", e);
    }
  };

  const handleOpenEditTake = (take) => {
    if (!take) return;
    setEditingTake(take);
    setEditingTakeDraft({
      rating_5:
        typeof take.rating_5 === "number" ? take.rating_5 : 0,
      take: take.take || "",
    });
  };

  const handleCloseEditTake = () => {
    if (editingTakeSaving) return;
    setEditingTake(null);
  };

  const handleSaveEditTake = async () => {
    if (!editingTake || !viewProfile?.id) return;

    setEditingTakeSaving(true);
    try {
      const newRating = Number(editingTakeDraft.rating_5) || null;
      const newText =
        editingTakeDraft.take && editingTakeDraft.take.trim()
          ? editingTakeDraft.take.trim()
          : null;

      const { data, error } = await supabase
      .from("club_film_takes")
        .update({
          rating_5: newRating,
          take: newText,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingTake.id)
        .eq("user_id", viewProfile.id)
        .select("*")
        .maybeSingle();

      if (error) throw error;

      // Update local state with fresh row
      setFilmTakes((prev) =>
        prev.map((t) =>
          t.id === editingTake.id ? { ...t, ...data } : t
        )
      );

      setEditingTake(null);
    } catch (e) {
      console.error("Failed to save edited take:", e);
      alert("Couldn't save that take. Please try again.");
    } finally {
      setEditingTakeSaving(false);
    }
  };


  /* ---------------- derived display from viewed profile ---------------- */
  const displayName = viewProfile?.display_name || "Your Name";
  const isPremiumProfile =
    viewProfile?.plan === "directors_cut" || viewProfile?.is_premium === true;

  const username = viewProfile?.slug || viewProfile?.username || "username";
  const bio = viewProfile?.bio || "";
  const clubName = viewProfile?.club_tag || "";
  const avatarUrl = viewProfile?.avatar_url || "/default-avatar.svg";

  const bannerUrl =
    bannerOverride ?? viewProfile?.banner_url ?? viewProfile?.banner_image ?? "";
  const bannerGradient =
    bannerGradientOverride ?? viewProfile?.banner_gradient ?? "";

 // allow null (default/base look) when no theme is selected
const themeId = isPremiumProfile ? (viewProfile?.theme_preset ?? null) : null;
const themeStyle = useMemo(() => getThemeVars(themeId), [themeId]);

  

  /* ---------------- banner component ---------------- */
  const Banner = () => {
    const style = bannerUrl
      ? {
          backgroundImage: `${bannerGradient ? bannerGradient + "," : ""}url(${bannerUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {};
    return (
      <div className="relative w-full h-[520px] sm:h-[500px] group rounded-none sm:rounded-2xl overflow-hidden" style={style}>
        {!bannerUrl && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-800 text-zinc-400">
            No banner selected yet
          </div>
        )}
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition" />
        <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-b from-transparent via-black/60 to-black pointer-events-none" />

        <div className="absolute top-4 right-4 z-20">
          {viewingOwn ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setEditOpen(true);
                setEditMode(true);
              }}
              className="bg-black/70 text-white text-sm px-4 py-2 rounded-full hover:bg-black/90 transition border border-white/10"
            >
              Edit Profile
            </button>
          ) : (
            <FollowButton profileId={viewProfile?.id} />
          )}
        </div>

        <div className="absolute bottom-0 left-0 w-full px-6 pb-6 z-10 flex items-end">
          <div className="flex items-end space-x-4 max-w-3xl w-full">
            <div className="relative w-24 h-24 shrink-0">
              <div
                className={
                  isPremiumProfile
                    ? "absolute inset-0 rounded-full themed-outline forge opacity-90 border border-transparent shadow-none"
                    : "absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,215,0,0.28),rgba(0,0,0,0.9))] opacity-70 pointer-events-none"
                }
              />
              <img
                src={avatarUrl}
                alt="Avatar"
                className={
                  isPremiumProfile
                    ? "w-full h-full rounded-full border border-white/15 object-cover shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
                    : "w-full h-full rounded-full border border-white/20 object-cover shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_14px_30px_rgba(0,0,0,0.45)]"
                }
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/default-avatar.svg";
                }}
              />
             {editMode && viewingOwn && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition">
                  <label
                    htmlFor="avatar-upload"
                    className={`cursor-pointer text-white text-sm px-3 py-1 rounded-full bg-black/60 border border-white/10 ${
                      uploadingAvatar ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                  >
                    {uploadingAvatar ? "Uploading…" : "Change"}
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    disabled={uploadingAvatar}
                  />
                </div>
              )}
            </div>
            <div className="w-full">
              {editMode && viewingOwn ? (
                <input
                  type="text"
                  defaultValue={displayName}
                  onBlur={(e) => {
                    const v = (e.target.value || "").trim();
                    if (v && v !== displayName) saveProfilePatch({ display_name: v });
                  }}
                  className="text-xl font-bold bg-zinc-800/40 p-1 rounded w-full"
                />
              ) : (
                <h2 className="text-xl font-bold">{displayName}</h2>
              )}
              {editMode && viewingOwn ? (
                <input
                  type="text"
                  defaultValue={username}
                  onBlur={(e) => {
                    const v = (e.target.value || "").trim();
                    if (v && v !== username) handleUsernameChange(v);
                  }}
                  className="text-sm text-gray-300 bg-zinc-800/40 p-1 rounded w-full mt-1"
                />
              ) : (
                <p className="text-sm text-gray-300 mt-1 flex items-center">
                  <span>@{username}</span>
                  {isPremiumProfile && <DirectorsCutBadge className="ml-2" size="xs" active />}
                </p>
              )}

              <div className="mt-1 flex items-center flex-wrap gap-2">
                <ClubBadge clubName={clubName} />
              </div>

              {editMode && viewingOwn ? (
                <textarea
                  defaultValue={bio}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v !== bio) saveProfilePatch({ bio: v });
                  }}
                  rows={2}
                  className="mt-1 text-sm text-white bg-zinc-800/40 p-2 rounded w-full resize-none"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-200">{bio}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ---------------- loading ---------------- */
  if (loading || viewLoading) {
    return (
      <div className="w-full text-white py-16 px-4 bg-black grid place-items-center">
        <div className="text-sm text-zinc-400">Loading profile…</div>
      </div>
    );
  }

  /* ---------------- render ---------------- */
  return (
    <div
      className="sf-theme w-full text-white py-4 sm:py-8 px-0 bg-black"
      style={themeStyle}
      data-theme={themeId}
    >
      <div className="w-full max-w-none mx-0 bg-black overflow-hidden sm:max-w-6xl sm:mx-auto sm:rounded-2xl sm:shadow-lg">
        <Banner />

        <StatsAndWatchlist
          statsData={{
            followers: counts.followers,
            following: counts.following,
            role: roleBadge,
            roleClub,
            isPremium: isPremiumProfile,    // NEW
          }}
          
          userId={viewProfile?.id}
          movieRoute="/movie"
          onFollowersClick={() => {
            const handle = viewProfile?.slug || viewProfile?.id;
            if (handle) navigate(`/u/${handle}/followers`);
          }}
          onFollowingClick={() => {
            const handle = viewProfile?.slug || viewProfile?.id;
            if (handle) navigate(`/u/${handle}/following`);
          }}
        />

        {/* Avatar cropper removed; direct file upload handles images now */}

        <div className="px-0 sm:px-6 pt-6">
          <div ref={moodboardAnchorRef} id="moodboard">
            <Moodboard
              profileId={viewProfile?.id}
              isOwner={viewingOwn}
              className="themed-card themed-outline forge w-full"
            />
          </div>
        </div>

        {/* Taste Cards — view */}
        {!editMode && liveTasteCards.length > 0 && (
          <section className="mt-6 px-0 sm:px-6">
            <div className={
              isPremiumProfile
                ? "themed-card themed-outline forge rounded-none sm:rounded-2xl border-t border-b border-zinc-900 sm:border sm:border-zinc-800 bg-black/40"
                : "rounded-none border-t border-b border-zinc-900 bg-black/40 sm:rounded-2xl sm:border sm:border-zinc-800"
            }>
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-900 sm:border-zinc-800">
                <h3 className="text-sm font-semibold text-white">Taste Cards</h3>
              </div>
              <ProfileTasteCards cards={liveTasteCards} globalGlow={liveGlobalGlow} />
            </div>
          </section>
        )}

        {/* Rating language — view (premium users' phrase groups) */}
        {!editMode && viewScheme?.tags?.length > 0 && (
          <section className="mt-6 px-0 sm:px-6">
            <div className={
              isPremiumProfile
                ? "themed-card themed-outline forge rounded-none sm:rounded-2xl border-t border-b border-zinc-900 sm:border sm:border-zinc-800 bg-black/40"
                : "rounded-none border-t border-b border-zinc-900 bg-black/40 sm:rounded-2xl sm:border sm:border-zinc-800"
            }>
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-900 sm:border-zinc-800">
                <h3 className="text-sm font-semibold text-white">Rating Language</h3>
              </div>
              <RatingSchemeView scheme={viewScheme} />
            </div>
          </section>
        )}

        {/* FILM TAKES — Preview (first 3 only) */}
        <section className="mt-5 sm:mt-8 px-0 sm:px-6">
          <div className={
            isPremiumProfile
              ? "themed-card themed-outline forge rounded-none sm:rounded-2xl border-t border-b border-zinc-900 sm:border sm:border-zinc-800 bg-black/30 p-4"
              : "rounded-none border-t border-b border-zinc-900 bg-black/30 p-4 sm:rounded-2xl sm:border sm:border-zinc-800"
          }>
            <div className="flex items-center mb-3 px-1 sm:px-0">
              <h3 className="text-sm font-semibold text-white">Film Takes</h3>
            </div>

            {filmTakesLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 rounded-xl border border-zinc-800 bg-zinc-900 animate-pulse"
                  />
                ))}
              </div>
            ) : filmTakes.length === 0 ? (
              <p className="text-xs text-zinc-500">No takes yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {filmTakes.slice(0, 3).map((take) => (
                  <div
                    key={take.id}
                    className={viewingOwn ? "cursor-pointer" : ""}
                    onClick={
                      viewingOwn ? () => handleOpenEditTake(take) : undefined
                    }
                  >
                    <FilmTakeCard take={take} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>


                {/* Edit Film Take modal (owner only) */}
                {viewingOwn && editingTake && (
          <div className="fixed inset-0 z-40 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60"
            onClick={handleCloseEditTake}
          />
          <div className="relative z-50 w-full max-w-md rounded-2xl border border-zinc-800 bg-black/90 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                  Edit Film Take
                </h3>
                <button
                  type="button"
                  onClick={handleCloseEditTake}
                  className="text-xs text-zinc-400 hover:text-zinc-200"
                  disabled={editingTakeSaving}
                >
                  Close
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs text-zinc-400 mb-1">
                    Rating (out of 5)
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.5"
                    value={editingTakeDraft.rating_5}
                    onChange={(e) =>
                      setEditingTakeDraft((prev) => ({
                        ...prev,
                        rating_5: e.target.value,
                      }))
                    }
                    className="w-24 rounded-lg border border-zinc-700 bg-black/70 px-2 py-1 text-sm text-white"
                  />
                </div>

                <div>
                  <div className="text-xs text-zinc-400 mb-1">
                    Your take
                  </div>
                  <textarea
                    rows={5}
                    value={editingTakeDraft.take}
                    onChange={(e) =>
                      setEditingTakeDraft((prev) => ({
                        ...prev,
                        take: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-zinc-700 bg-black/70 p-2 text-sm text-white"
                    placeholder="Rewrite or polish your thoughts…"
                  />
                </div>

                <div className="flex justify-between items-center pt-1">
                  <button
                    type="button"
                    onClick={() => handleRemoveTake(editingTake.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                    disabled={editingTakeSaving}
                  >
                    Delete take
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditTake}
                    disabled={editingTakeSaving}
                    className="rounded-lg bg-yellow-500 px-4 py-1.5 text-xs font-medium text-black hover:bg-yellow-400 disabled:opacity-60"
                  >
                    {editingTakeSaving ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}




        {/* Edit panel in a PORTAL — mount only when open */}
        {editOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <EditProfilePanel
              open={true}
              onClose={() => {
                setEditOpen(false);
                setEditMode(false);
              }}
              onUpdated={handlePanelUpdated}
              profile={viewProfile}
              profileId={viewProfile?.id}
              isOwner={viewingOwn}
            />,
            document.body
          )}

        {/* Avatar cropper modal */}
        {showAvatarCropper && rawAvatarImage && (
          <AvatarCropper
            imageSrc={rawAvatarImage}
            variant="avatar"
            onCancel={() => {
              setShowAvatarCropper(false);
              setRawAvatarImage(null);
            }}
            onCropComplete={async (blob, previewUrl) => {
              try {
                setUploadingAvatar(true);
                const publicUrl = await uploadAvatar(blob, user.id, {
                  prevUrl: viewProfile?.avatar_url || undefined,
                });
                await saveProfilePatch({ avatar_url: publicUrl });
                setAvatar(publicUrl);
                setViewProfile((prev) => (prev ? { ...prev, avatar_url: publicUrl } : prev));
              } catch (err) {
                console.error("Failed to save avatar:", err);
              } finally {
                setUploadingAvatar(false);
                setShowAvatarCropper(false);
                setRawAvatarImage(null);
              }
            }}
          />
        )}
      </div>
    </div>
  );
};

export default UserProfile;
