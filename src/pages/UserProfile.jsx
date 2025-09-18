// src/pages/UserProfile.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import StatsAndWatchlist from "../components/StatsAndWatchlist";
import FavoriteFilmsGrid from "../components/FavoriteFilmsGrid";
import FavoriteFilmsPicker from "../components/FavoriteFilmsPicker";
import TasteCard from "../components/TasteCard";
import TasteCardPicker from "../components/TasteCardPicker";
import ClubBadge from "../components/ClubBadge";
import AvatarCropper from "../components/AvatarCropper";
import { glowOptions } from "../constants/glowOptions";
import { useUser } from "../context/UserContext";
import EditProfilePanel from "../components/EditProfilePanel";

// NEW: role pill + follow + supabase
import RolePill from "../components/RolePill.jsx";
import FollowButton from "../components/FollowButton.jsx";
import supabase from "../supabaseClient.js";

// NEW: tiny badge next to the name
import RoleBadge from "../components/RoleBadge.jsx";

const UserProfile = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { user, profile, setAvatar, saveProfilePatch, loading } = useUser();

  // UI state
  const [editMode, setEditMode] = useState(false);
  const [editingTasteCards, setEditingTasteCards] = useState([]);
  const [editOpen, setEditOpen] = useState(false);

  // Avatar cropper state
  const [rawAvatarImage, setRawAvatarImage] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  // Local toggles
  const [useGlowStyle] = useState(true);

  // Banner overrides (for instant update when changed in panel)
  const [bannerOverride, setBannerOverride] = useState(null);
  const [bannerGradientOverride, setBannerGradientOverride] = useState(null);

  // Derived profile values with fallbacks
  const displayName = profile?.display_name || "Your Name";
  const username = profile?.slug || "username";
  const bio = profile?.bio || "";
  const clubName = profile?.club_tag || "";
  const avatarUrl = profile?.avatar_url || "/avatars/default.jpg";

  // Prefer override, fallback to DB values
  const bannerUrl =
    bannerOverride ?? profile?.banner_url ?? profile?.banner_image ?? "";
  const bannerGradient =
    bannerGradientOverride ?? profile?.banner_gradient ?? "";
  const glowPreset = profile?.glow_preset ?? null;

  // Favorite films
  const favouriteFilmsRaw = useMemo(
    () => (Array.isArray(profile?.favorite_films) ? profile.favorite_films : []),
    [profile?.favorite_films]
  );
  const favouriteFilmsView = useMemo(
    () =>
      favouriteFilmsRaw.map((f) => ({
        ...f,
        posterPath: f.posterPath ?? f.poster_path ?? "",
      })),
    [favouriteFilmsRaw]
  );

  // Taste cards
  const tasteAnswers = useMemo(
    () => (Array.isArray(profile?.taste_cards) ? profile.taste_cards : []),
    [profile?.taste_cards]
  );

  // NEW: viewing state, role badge, and follow counts
  const viewingOwn = user?.id && profile?.id ? user.id === profile.id : true;
  // 🔄 store full top-role object (not just string)
  const [roleBadge, setRoleBadge] = useState(null);   // 'president' | 'vice_president' | 'editor_in_chief' | null
  const [roleClub, setRoleClub] = useState(null);     // { club_slug, club_name, club_id } | null
  const [counts, setCounts] = useState({ followers: 0, following: 0 });

  // Bootstrap from ?edit=true
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("edit") === "true") {
      setEditMode(true);
      setEditingTasteCards([...tasteAnswers]);
      params.delete("edit");
      navigate({ search: params.toString() }, { replace: true });
    }
  }, [location.search, tasteAnswers, navigate]);

  // Bootstrap banner override from localStorage (optional)
  useEffect(() => {
    const ls = localStorage.getItem("userBanner");
    if (ls && !bannerOverride) setBannerOverride(ls);
  }, [bannerOverride]);

  // NEW: fetch role + follow counts for the profile owner
  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!profile?.id) return;

      // Highest-priority role from profile_roles view (president > vp > editor)
      const { data: rolesRow, error: rolesErr } = await supabase
        .from("profile_roles")
        .select("roles")
        .eq("user_id", profile.id)
        .maybeSingle();

      if (!rolesErr && isMounted) {
        const roles = rolesRow?.roles || [];
        const top = roles?.[0] || null; // { role, club_slug, club_name, club_id }
        setRoleBadge(top?.role || null);
        setRoleClub(
          top
            ? { club_slug: top.club_slug, club_name: top.club_name, club_id: top.club_id }
            : null
        );
      }

      // Followers / Following counts from follow_counts view
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

  // Username change w/ 90-day lock
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

  // Avatar upload + crop
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

  // Favorite films helpers
  const toDbShape = (arr) =>
    (Array.isArray(arr) ? arr : []).map((m) => ({
      id: m?.id ?? null,
      title: m?.title ?? "",
      glowClass: m?.glowClass || "",
      poster_path: m?.poster_path ?? m?.posterPath ?? "",
    }));

  const handleSetFavoriteFilms = (updater) => {
    try {
      const current = Array.isArray(favouriteFilmsView)
        ? favouriteFilmsView
        : [];
      const nextView =
        typeof updater === "function" ? updater(current) : updater;
      if (!Array.isArray(nextView)) return;

      const cleaned = nextView
        .filter(Boolean)
        .map((m) => ({
          ...m,
          id: m?.id ?? null,
          title: m?.title ?? "",
          glowClass: m?.glowClass || "",
          posterPath: m?.posterPath ?? m?.poster_path ?? "",
        }))
        .filter((m) => m.id && typeof m.posterPath === "string");

      const nextDb = toDbShape(cleaned);
      saveProfilePatch({ favorite_films: nextDb }).catch((e) =>
        console.error("Failed to save favorite films:", e)
      );
    } catch (err) {
      console.error("handleSetFavoriteFilms crashed:", err);
    }
  };

  const handleRemoveFavorite = (title) => {
    const nextDb = favouriteFilmsRaw.filter((f) => f.title !== title);
    saveProfilePatch({ favorite_films: nextDb }).catch((e) =>
      console.error("Failed to remove favorite film:", e)
    );
  };

  const handleTasteCardsChange = async (next) => {
    try {
      await saveProfilePatch({ taste_cards: next });
    } catch (e) {
      console.warn("Saving taste_cards failed:", e);
    }
  };

  // Apply updates from edit panel (instant banner update)
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

    const { banner_url, banner_image, banner_gradient, ...rest } = patch;
    if (Object.keys(rest).length) {
      try { await saveProfilePatch(rest); }
      catch (e) { console.error("Failed to apply profile patch:", e); }
    }
  };

  // NEW: navigate to club from role pill
  const handleGoToRoleClub = () => {
    if (!roleClub) return;
    const path = roleClub.club_slug
      ? `/clubs/${roleClub.club_slug}`
      : `/clubs/${roleClub.club_id}`;
    navigate(path);
  };

  // Banner renderer
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

        {/* Edit vs Follow */}
        <div className="absolute top-4 right-4 z-20">
          {viewingOwn ? (
            <button
              onClick={() => setEditOpen(true)}
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
              {editMode && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition">
                  <label htmlFor="avatar-upload" className="cursor-pointer text-white text-lg">📷</label>
                  <input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </div>
              )}
            </div>
            <div className="w-full">
              {editMode ? (
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => saveProfilePatch({ display_name: e.target.value })}
                  className="text-xl font-bold bg-zinc-800/40 p-1 rounded w-full"
                />
              ) : (
                // NEW: badge next to the name
                <h2 className="text-xl font-bold flex items-center gap-2">
                  {displayName}
                  <RoleBadge role={roleBadge} />
                </h2>
              )}
              {editMode ? (
                <input
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className="text-sm text-gray-300 bg-zinc-800/40 p-1 rounded w-full mt-1"
                />
              ) : (
                <p className="text-sm text-gray-300">@{username}</p>
              )}

              {/* Identity + Role pills row under name */}
              <div className="mt-1 flex items-center flex-wrap gap-2">
                <ClubBadge clubName={clubName} />
                {/* NEW: show a RolePill if the user has a top role */}
                {roleBadge && (
                  <RolePill
                    role={roleBadge}
                    club={roleClub}
                    onClick={handleGoToRoleClub}
                  />
                )}
              </div>

              {editMode ? (
                <textarea
                  value={bio}
                  onChange={(e) => saveProfilePatch({ bio: e.target.value })}
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

  if (loading) {
    return (
      <div className="w-full text-white py-16 px-4 bg-black grid place-items-center">
        <div className="text-sm text-zinc-400">Loading your profile…</div>
      </div>
    );
  }

  return (
    <div className="w-full text-white py-8 px-4 bg-black">
      <div className="max-w-6xl mx-auto bg-black rounded-2xl overflow-hidden shadow-lg">
        <Banner />

        {/* ⬇️ Keep your existing Watchlist layout intact. */}
        <StatsAndWatchlist
          statsData={{
            followers: counts.followers,
            following: counts.following,
            role: roleBadge,
            roleClub, // { club_slug, club_name, club_id }
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

        {/* Favorites */}
        {editMode && (
          <FavoriteFilmsPicker
            films={favouriteFilmsView}
            editMode={editMode}
            setFavoriteFilms={handleSetFavoriteFilms}
            onRemove={handleRemoveFavorite}
            useGlowStyle={useGlowStyle}
            enableHoverEffect
            enableNavigation={false}
            onFilmClick={() => {}}
          />
        )}

        <div className="px-6 pt-6 w-1/2">
          <FavoriteFilmsGrid
            films={favouriteFilmsView}
            setFilms={(next) => handleSetFavoriteFilms(next)}
            editMode={editMode}
            useGlowStyle={useGlowStyle}
          />
        </div>

        {editMode && (
          <div className="px-6 pt-8">
            <TasteCardPicker
              selected={editingTasteCards}
              setSelected={(next) => {
                setEditingTasteCards(next);
                handleTasteCardsChange(next);
              }}
              useGlowStyle={useGlowStyle}
              setUseGlowStyle={(val) => saveProfilePatch({ use_glow_style: !!val })}
            />
          </div>
        )}

        {!editMode && tasteAnswers.length > 0 && (
          <div className="mt-10 px-6">
            <h3 className="text-lg font-semibold mb-4">Taste Questions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {tasteAnswers.map((item, index) => {
                const chosenClass = item.glowClass || glowPreset;
                const glow = glowOptions.free.find((g) => g.class === chosenClass);
                return (
                  <TasteCard
                    key={index}
                    question={item.question}
                    answer={item.answer}
                    glowColor={glow?.color || "#FF0000"}
                    glowStyle={glow?.glow || "none"}
                    useGlowStyle={useGlowStyle}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Slide-out edit panel */}
        <EditProfilePanel
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onUpdated={handlePanelUpdated}
          // If/when your EditProfilePanel supports role-signing via clubId, pass it here:
          // clubId={roleClub?.club_id}
        />
      </div>
    </div>
  );
};

export default UserProfile;
