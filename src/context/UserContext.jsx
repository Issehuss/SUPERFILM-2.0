// src/context/UserContext.jsx
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import supabase from "../supabaseClient.js";

/**
 * Exposed:
 * - user: Supabase auth user (null if signed out)
 * - profile: row from public.profiles (banner_url, banner_gradient, favorite_films, etc.)
 * - loading: boolean while bootstrapping / switching sessions
 * - avatar, setAvatar: UI-level avatar (synced with profile.avatar_url)
 * - saveProfilePatch(patch): updates public.profiles for the signed-in user and syncs context
 * - refreshProfile(): re-fetches the profile from DB
 */
const UserContext = createContext(null);
export const useUser = () => useContext(UserContext);

// Only select columns we actually use in the app.
// (Removed "roles" and "joined_clubs" which were causing 400s if absent.)
const PROFILE_COLUMNS = [
  "id",
  "slug",
  "display_name",
  "avatar_url",
  "banner_url",
  "banner_gradient",
  "favorite_films",
  "bio",
  "taste_cards",
  "glow_preset",
  "club_tag",
].join(",");

export const UserProvider = ({ children }) => {
  const [loading, setLoading] = useState(true);

  // Local avatar fallback for snappy UI
  const [avatar, setAvatar] = useState(() => {
    return localStorage.getItem("userAvatar") || "/avatars/default.jpg";
  });

  // Auth + Profile
  const [user, setUser] = useState(null);      // null when signed out
  const [profile, setProfile] = useState(null); // null until loaded

  useEffect(() => {
    localStorage.setItem("userAvatar", avatar);
  }, [avatar]);

  // ------- DB helpers -------
  const fetchProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", userId)
      .single();

    if (error) {
      // Better console visibility than "[object Object]"
      try {
        // eslint-disable-next-line no-console
        console.error("fetchProfile error:", error, JSON.stringify(error));
      } catch {
        // eslint-disable-next-line no-console
        console.error("fetchProfile error:", error);
      }
      throw error;
    }
    return data;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return null;
    const p = await fetchProfile(user.id);
    setProfile(p);
    if (p?.avatar_url) setAvatar(p.avatar_url);
    return p;
  }, [user, fetchProfile]);

  const saveProfilePatch = useCallback(async (patch) => {
    if (!user) throw new Error("Not signed in");
    const { data, error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", user.id)
      .select(PROFILE_COLUMNS)
      .single();

    if (error) {
      try {
        // eslint-disable-next-line no-console
        console.error("saveProfilePatch error:", error, JSON.stringify(error), "patch:", patch);
      } catch {
        // eslint-disable-next-line no-console
        console.error("saveProfilePatch error:", error);
      }
      throw error;
    }

    // Keep context canonical with server
    setProfile((prev) => ({ ...(prev || {}), ...data }));

    // Sync UI avatar if changed
    if (data?.avatar_url) setAvatar(data.avatar_url);

    return data;
  }, [user]);

  // ------- Bootstrap on load -------
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        const authUser = session?.user || null;

        if (!authUser) {
          if (isMounted) {
            setUser(null);
            setProfile(null);
          }
          return;
        }

        const p = await fetchProfile(authUser.id);

        if (isMounted) {
          setUser(authUser);
          setProfile(p);
          if (p?.avatar_url) setAvatar(p.avatar_url);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    // Listen for sign-in/sign-out and token refresh events
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setLoading(true);
        try {
          const authUser = session.user;
          const p = await fetchProfile(authUser.id);
          setUser(authUser);
          setProfile(p);
          if (p?.avatar_url) setAvatar(p.avatar_url);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [fetchProfile]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      avatar,
      setAvatar,
      saveProfilePatch,
      refreshProfile,
    }),
    [user, profile, loading, avatar, saveProfilePatch, refreshProfile]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export default UserContext;
