// src/context/UserContext.jsx
import { createContext, useContext, useState, useEffect, useMemo } from "react";
import supabase from "../supabaseClient.js";

const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  // UI state
  const [loading, setLoading] = useState(true);

  // Avatar (persist to localStorage as a manual override/fallback)
  const [avatar, setAvatar] = useState(() => {
    return localStorage.getItem("userAvatar") || "/avatars/default.jpg";
  });

  // App-level user object (merged from auth + profile)
  const [user, setUser] = useState(null); // ✅ changed from dev fallback to null

  useEffect(() => {
    localStorage.setItem("userAvatar", avatar);
  }, [avatar]);

  // Fetch profile from DB
  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, roles, joined_clubs")
      .eq("id", userId)
      .single();

    if (error) {
      console.warn("fetchProfile error:", error.message);
      return null;
    }
    return data;
  };

  // Initial auth + profile load
  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const authedUser = authData?.user;
        if (!authedUser) {
          if (isMounted) {
            setUser(null); // ✅ now truly null when no user
          }
          return;
        }

        // ✅ fast path: auth user baseline
        if (isMounted) {
          setUser({
            id: authedUser.id,
            email: authedUser.email,
            name: "Current User",
            roles: ["member"],
            joinedClubs: [],
          });
        }

        // background fetch and merge
        fetchProfile(authedUser.id)
          .then((profile) => {
            if (!isMounted || !profile) return;
            const dbAvatar = profile?.avatar_url;
            if (dbAvatar && !localStorage.getItem("userAvatar")) setAvatar(dbAvatar);

            setUser((prev) => ({
              ...prev,
              name: profile?.display_name || prev.name,
              roles: Array.isArray(profile?.roles) ? profile.roles : profile?.roles ?? prev.roles,
              joinedClubs: Array.isArray(profile?.joined_clubs)
                ? profile.joined_clubs
                : profile?.joined_clubs ?? prev.joinedClubs,
            }));
          })
          .catch(() => {});
      } catch (e) {
        console.warn("Auth/profile load error:", e.message);
        if (isMounted) {
          setUser(null); // ✅ again, null on error
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    // Supabase auth subscription
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!isMounted) return;

      if (!session?.user) {
        setUser(null); // ✅ signed out = null
        return;
      }

      setUser({
        id: session.user.id,
        email: session.user.email,
        name: "Current User",
        roles: ["member"],
        joinedClubs: [],
      });
      setLoading(false);

      // Background enrich
      fetchProfile(session.user.id)
        .then((profile) => {
          if (!profile) return;
          const dbAvatar = profile?.avatar_url;
          if (dbAvatar && !localStorage.getItem("userAvatar")) setAvatar(dbAvatar);

          setUser((prev) => ({
            ...prev,
            name: profile?.display_name || prev.name,
            roles: Array.isArray(profile?.roles) ? profile.roles : profile?.roles ?? prev.roles,
            joinedClubs: Array.isArray(profile?.joined_clubs)
              ? profile.joined_clubs
              : profile?.joined_clubs ?? prev.joinedClubs,
          }));
        })
        .catch(() => {});
    });

    return () => {
      isMounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  // Optional helpers
  const signInWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = useMemo(
    () => ({
      loading,
      avatar,
      setAvatar,
      user,
      setUser,
      signInWithEmail,
      signOut,
    }),
    [loading, avatar, user]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = () => useContext(UserContext);




