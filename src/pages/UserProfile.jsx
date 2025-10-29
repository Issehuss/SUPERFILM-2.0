// src/pages/UserProfile.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
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
    <svg width={size} height={size} viewBox="0 0 24 24" className={filled ? "text-yellow-400" : "text-zinc-600"}>
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
      {Array.from({ length: full }).map((_, i) => <Star key={`f${i}`} filled />)}
      {half ? <Half key="h" /> : null}
      {Array.from({ length: empty }).map((_, i) => <Star key={`e${i}`} filled={false} />)}
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

          {t.blurb ? <p className="mt-2 text-sm text-zinc-200 line-clamp-3">{t.blurb}</p> : null}

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
  const { user, profile, setAvatar, saveProfilePatch, loading } = useUser();

  // View vs edit
  const [editMode, setEditMode] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  // Avatar editing
  const [rawAvatarImage, setRawAvatarImage] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  // Banner overrides (local only)
  const [bannerOverride, setBannerOverride] = useState(null);
  const [bannerGradientOverride, setBannerGradientOverride] = useState(null);

  // Derived profile fields (safe fallbacks if profile null)
  const displayName = profile?.display_name || "Your Name";
  const isPremiumProfile =
  profile?.plan === "directors_cut" || profile?.is_premium === true;

  const username = profile?.slug || "username";
  const bio = profile?.bio || "";
  const clubName = profile?.club_tag || "";
  const avatarUrl = profile?.avatar_url || "/avatars/default.jpg";

  const bannerUrl = bannerOverride ?? profile?.banner_url ?? profile?.banner_image ?? "";
  const bannerGradient = bannerGradientOverride ?? profile?.banner_gradient ?? "";

  const themeId = profile?.theme_preset || "classic";
  const themeStyle = useMemo(() => getThemeVars(themeId), [themeId]);

  // Taste Cards — live view state (stays in sync with panel)
 // Taste Cards — live view state (stays in sync with panel)
const [liveTasteCards, setLiveTasteCards] = useState(
  Array.isArray(profile?.taste_cards) ? profile.taste_cards : []
);
const [liveGlobalGlow, setLiveGlobalGlow] = useState(
  profile?.taste_card_style_global ?? null
);

useEffect(() => {
  setLiveTasteCards(Array.isArray(profile?.taste_cards) ? profile.taste_cards : []);
}, [profile?.taste_cards]);

useEffect(() => {
  setLiveGlobalGlow(profile?.taste_card_style_global ?? null);
}, [profile?.taste_card_style_global]);


  useEffect(() => {
    function onTasteCardsUpdated(e) {
      if (Array.isArray(e?.detail?.cards)) {
        setLiveTasteCards(e.detail.cards);
      }
    }
    window.addEventListener("sf:tastecards:updated", onTasteCardsUpdated);
    return () => window.removeEventListener("sf:tastecards:updated", onTasteCardsUpdated);
  }, []);

  // Premium rating scheme (view mode)
const [viewScheme, setViewScheme] = useState(null);

useEffect(() => {
  let mounted = true;
  async function loadScheme() {
    if (!profile?.id) {
      if (mounted) setViewScheme(null);
      return;
    }
    try {
      const sch = await fetchActiveScheme(profile.id);
      if (mounted) setViewScheme(sch);
    } catch {
      if (mounted) setViewScheme(null);
    }
  }
  loadScheme();
  return () => { mounted = false; };
}, [profile?.id]);

// (optional) listen for panel updates to refresh scheme without reload
useEffect(() => {
  function onSchemeUpdated() {
    if (!profile?.id) return;
    fetchActiveScheme(profile.id).then((sch) => setViewScheme(sch)).catch(() => {});
  }
  window.addEventListener("sf:ratingscheme:updated", onSchemeUpdated);
  return () => window.removeEventListener("sf:ratingscheme:updated", onSchemeUpdated);
}, [profile?.id]);


  // Editing buffer (not rendered here; panel handles UI)
  const [editingTasteCards, setEditingTasteCards] = useState([]);

  const viewingOwn = user?.id && profile?.id ? user.id === profile.id : true;

  const [roleBadge, setRoleBadge] = useState(null);
  const [roleClub, setRoleClub] = useState(null);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });

  // anchor for Moodboard
  const moodboardAnchorRef = useRef(null);

  /* ---------------- effects ---------------- */
  // Respect ?edit=true (open once, then clean URL)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("edit") === "true") {
      setEditMode(true);
      setEditOpen(true);
      setEditingTasteCards(Array.isArray(profile?.taste_cards) ? [...profile.taste_cards] : []);
      params.delete("edit");
      navigate({ search: params.toString() }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // Restore banner from localStorage (if present)
  useEffect(() => {
    try {
      const ls = localStorage.getItem("userBanner");
      if (ls && !bannerOverride) setBannerOverride(ls);
    } catch {}
  }, [bannerOverride]);

  // Exit edit mode when panel broadcasts close
  useEffect(() => {
    function handleExitEdit() {
      setEditOpen(false);
      setEditMode(false);
    }
    window.addEventListener("sf:editpanel:close", handleExitEdit);
    return () => window.removeEventListener("sf:editpanel:close", handleExitEdit);
  }, []);

  // Role pill + follow counts
  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!profile?.id) return;

      const { data: rolesRow } = await supabase
        .from("profile_roles")
        .select("roles")
        .eq("user_id", profile.id)
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
        .eq("user_id", profile.id)
        .maybeSingle();

      if (isMounted && fc) setCounts(fc);
    })();
    return () => {
      isMounted = false;
    };
  }, [profile?.id]);

  // Navigate to the profile view after the panel reports a successful save
  useEffect(() => {
    function onProfileSaved() {
      const path =
        (profile?.slug && `/u/${profile.slug}`) ||
        (profile?.id && `/profile/${profile.id}`) ||
        "/myprofile";

      navigate(path, { replace: true });
      setEditOpen(false);
      setEditMode(false);
    }

    window.addEventListener("sf:profile:saved", onProfileSaved);
    return () => window.removeEventListener("sf:profile:saved", onProfileSaved);
  }, [navigate, profile?.slug, profile?.id]);

  /* ---------------- handlers ---------------- */
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

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setRawAvatarImage(reader.result);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedImageUrl) => {
    try {
      await saveProfilePatch({ avatar_url: croppedImageUrl });
      setAvatar(croppedImageUrl);
    } catch (e) {
      console.error("Failed to save avatar:", e);
    }
    setShowCropper(false);
  };

  const handlePanelUpdated = async (patch) => {
    if (!patch) return;

    if (typeof patch.banner_url === "string" && patch.banner_url) {
      setBannerOverride(patch.banner_url);
      try { localStorage.setItem("userBanner", patch.banner_url); } catch {}
    } else if (typeof patch.banner_image === "string" && patch.banner_image) {
      setBannerOverride(patch.banner_image);
      try { localStorage.setItem("userBanner", patch.banner_image); } catch {}
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

    // reflect global glow immediately in view mode
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

    const current = Array.isArray(profile?.film_takes) ? profile.film_takes : [];
    const next = current.filter((t) => t.id !== id);
    try {
      await saveProfilePatch({ film_takes: next });
    } catch (e) {
      console.error("Failed to remove take:", e);
    }
  };

  /* ---------------- banner ---------------- */
  const Banner = () => {
    const style = bannerUrl
      ? {
          backgroundImage: `${bannerGradient ? bannerGradient + "," : ""}url(${bannerUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {};
    return (
      <div className="relative w-full h-[500px] group" style={style}>
        {!bannerUrl && (
          <div className="absolute inset-0 grid place-items-center bg-zinc-800 text-zinc-400">
            No banner selected yet
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition" />
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-b from-transparent to-black pointer-events-none" />

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
            <FollowButton profileId={profile?.id} />
          )}
        </div>

        <div className="absolute bottom-0 left-0 w-full px-6 pb-6 z-10 flex items-end">
          <div className="flex items-end space-x-4 max-w-3xl w-full">
            <div className="relative w-24 h-24 shrink-0">
              <img
                src={avatarUrl}
                alt="Avatar"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/avatars/default.jpg";
                }}
                className="w-full h-full rounded-full border-4 border-black object-cover"
              />
              {editMode && viewingOwn && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition">
                  <label
                    htmlFor="avatar-upload"
                    className="cursor-pointer text-white text-sm px-3 py-1 rounded-full bg-black/60 border border-white/10"
                  >
                    Change
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
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
  {isPremiumProfile && <DirectorsCutBadge className="ml-2" size="xs" />}
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
  if (loading) {
    return (
      <div className="w-full text-white py-16 px-4 bg-black grid place-items-center">
        <div className="text-sm text-zinc-400">Loading your profile…</div>
      </div>
    );
  }

  const filmTakes = Array.isArray(profile?.film_takes) ? profile.film_takes : [];

  /* ---------------- render ---------------- */
  return (
    <div
      className="sf-theme w-full text-white py-8 px-4 bg-black"
      style={themeStyle}
      data-theme={themeId}
    >
      <div className="max-w-6xl mx-auto bg-black rounded-2xl overflow-hidden shadow-lg">
        <Banner />

        <StatsAndWatchlist
          statsData={{
            followers: counts.followers,
            following: counts.following,
            role: roleBadge,
            roleClub,
            className: "themed-card themed-outline forge",
          }}
          userId={profile?.id}
          movieRoute="/movie"
        />

        {showCropper && rawAvatarImage && (
          <AvatarCropper
            imageSrc={rawAvatarImage}
            onCropComplete={handleCropComplete}
            onCancel={() => setShowCropper(false)}
          />
        )}

        <div className="px-6 pt-6">
          <div ref={moodboardAnchorRef} id="moodboard">
            <Moodboard
              profileId={profile?.id}
              isOwner={viewingOwn}
              className="themed-card themed-outline forge w-full"
            />
          </div>
        </div>

        {/* Taste Cards — view */}
        {!editMode && liveTasteCards.length > 0 && (
          <section className="mt-6 px-6">
            <div className="themed-card themed-outline forge rounded-2xl border bg-black/40">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-white">Taste Cards</h3>
              </div>
              <ProfileTasteCards
                cards={liveTasteCards}
                globalGlow={liveGlobalGlow}
              />
            </div>
          </section>
        )}

        {/* Rating language — view (premium users' phrase groups) */}
{!editMode && viewScheme?.tags?.length > 0 && (
  <section className="mt-6 px-6">
    <div className="themed-card themed-outline forge rounded-2xl border bg-black/40">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-white">Rating Language</h3>
      </div>
      <RatingSchemeView scheme={viewScheme} />
    </div>
  </section>
)}


        {/* Film Takes */}
        <section className="mt-6 px-6">
          <div className="themed-card themed-outline forge rounded-2xl border bg-black/40">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-white">Film Takes</h3>
            </div>

            {filmTakes.length === 0 ? (
              <div className="px-4 py-6 text-sm text-zinc-400">No takes yet.</div>
            ) : (
              <ul className="px-2 py-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                {filmTakes.map((t, idx) => (
                  <ClubTakeItem
                    key={t.id || idx}
                    t={t}
                    showUser={false}
                    canEdit={viewingOwn && editMode}
                    onRemove={() => handleRemoveTake(t.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>

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
              profile={profile}
              profileId={profile?.id}
              isOwner={viewingOwn}
            />,
            document.body
          )}
      </div>
    </div>
  );
};

export default UserProfile;
