// src/context/UserContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import supabase from "../supabaseClient.js";

const UserContext = createContext(null);
export const useUser = () => useContext(UserContext);

function UserProvider({ children }) {
  const [user, setUser] = useState(null);        // auth user (null if signed out)
  const [profile, setProfile] = useState(null);  // row from public.profiles
  const [avatar, setAvatar] = useState(null);    // convenience
  const [loading, setLoading] = useState(true);

  // ─────────────────────────────
  // 1) fetch session on mount
  // ─────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) throw error;

        const authUser = session?.user ?? null;
        if (!cancelled) {
          setUser(authUser);
        }

        if (authUser?.id) {
          const { data: prof, error: pErr } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", authUser.id)
            .maybeSingle();

          if (!cancelled) {
            if (pErr) {
              console.warn("[UserContext] profile fetch failed:", pErr.message);
              setProfile(null);
              setAvatar(null);
            } else {
              setProfile(prof);
              setAvatar(prof?.avatar_url || null);
            }
          }
        } else {
          // no auth user
          if (!cancelled) {
            setProfile(null);
            setAvatar(null);
          }
        }
      } catch (e) {
        console.warn("[UserContext] init error:", e?.message);
        if (!cancelled) {
          setUser(null);
          setProfile(null);
          setAvatar(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // listen to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const authUser = session?.user ?? null;
      setUser(authUser);

      if (authUser?.id) {
        const { data: prof, error: pErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle();

        if (pErr) {
          console.warn("[UserContext] profile fetch (auth change) failed:", pErr.message);
          setProfile(null);
          setAvatar(null);
        } else {
          setProfile(prof);
          setAvatar(prof?.avatar_url || null);
        }
      } else {
        setProfile(null);
        setAvatar(null);
      }
    });

    return () => {
      cancelled = true;
      subscription?.unsubscribe?.();
    };
  }, []);

  // ─────────────────────────────
  // 2) normalise roles
  // ─────────────────────────────
  const roles = useMemo(() => {
    const arr = [];

    // from profile table
    if (profile?.roles && Array.isArray(profile.roles)) {
      arr.push(...profile.roles);
    }

    // sometimes we store as app_roles
    if (profile?.app_roles && Array.isArray(profile.app_roles)) {
      arr.push(...profile.app_roles);
    }

    // from auth JWT user_metadata
    if (user?.user_metadata?.roles && Array.isArray(user.user_metadata.roles)) {
      arr.push(...user.user_metadata.roles);
    }

    // dedupe, trim
    return Array.from(
      new Set(
        arr
          .filter(Boolean)
          .map((r) => String(r).trim())
          .filter(Boolean)
      )
    );
  }, [profile?.roles, profile?.app_roles, user?.user_metadata?.roles]);

  const hasRole = useCallback(
    (role) => {
      if (!role) return false;
      return roles.some((r) => r.toLowerCase() === role.toLowerCase());
    },
    [roles]
  );

  const isPartner = hasRole("partner");

  // ─────────────────────────────
  // 3) Premium flag (dev override + real checks)
  //    Remove DEV_PREMIUM_EMAILS before production.
  // ─────────────────────────────
  const DEV_PREMIUM_EMAILS = ["husseinisse632@gmail.com"]; // dev-only override

  const isPremium = useMemo(() => {
    // 1) Local dev override by email
    const emailHit = DEV_PREMIUM_EMAILS.includes(user?.email || "");

    // 2) Role-based (if you add "premium" or "directors_cut" to roles)
    const roleHit = (roles || []).some((r) =>
      /^(premium|directors_cut)$/i.test(String(r || ""))
    );

    // 3) Plan field on profile or on auth user_metadata
    const plan = String(profile?.plan || "").toLowerCase();
    const metaPlan = String(user?.user_metadata?.plan || "").toLowerCase();
    const planHit =
      plan === "directors_cut" ||
      plan === "premium" ||
      metaPlan === "directors_cut" ||
      metaPlan === "premium";

    return emailHit || roleHit || planHit;
  }, [user?.email, roles, profile?.plan, user?.user_metadata?.plan]);

  // ─────────────────────────────
  // 4) helper to PATCH profile
  // ─────────────────────────────
  const saveProfilePatch = useCallback(
    async (patch) => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", user.id)
        .select()
        .maybeSingle();
      if (error) {
        console.warn("[UserContext] saveProfilePatch failed:", error.message);
        return;
      }
      setProfile((prev) => ({ ...(prev || {}), ...(data || patch) }));
      if (data?.avatar_url) {
        setAvatar(data.avatar_url);
      }
    },
    [user?.id]
  );

  // ─────────────────────────────
  // 5) logout
  // ─────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setAvatar(null);
  }, []);

  // ─────────────────────────────
  // 6) provider value
  // ─────────────────────────────
  return (
    <UserContext.Provider
      value={{
        user,          // supabase auth user
        profile,       // public.profiles row
        avatar,        // convenience
        loading,       // initial hydration
        roles,         // normalised array
        hasRole,       // helper
        isPartner,     // partner flag
        isPremium,     // ★ premium flag (dev override + real checks)
        saveProfilePatch,
        logout,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export { UserProvider };
export default UserProvider;
