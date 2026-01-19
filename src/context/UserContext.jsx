// src/context/UserContext.jsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import supabase from "../supabaseClient.js";

const UserContext = createContext(null);
export const useUser = () => useContext(UserContext);

function UserProvider({ children }) {
  const [user, setUser] = useState(null);            // supabase.auth user
  const [session, setSession] = useState(null);      // supabase.auth session
  const [profile, setProfile] = useState(null);      // row in profiles
  const [avatar, setAvatar] = useState(null);        // convenience
  const [loading, setLoading] = useState(true);      // full hydration state
  const [sessionLoaded, setSessionLoaded] = useState(false); // ★ new — token restored
  const [subscription, setSubscription] = useState(null); // cached subscription row
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const lastProfileFetchRef = useRef(0);
  const refreshInFlightRef = useRef(null);

  /* ---------------------------------------------------------------------- */
  /*                           INITIAL HYDRATION                            */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1) Restore session from local storage
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error) throw error;

        setSessionLoaded(true);  // ★ session token now available

        setSession(session || null);
        const authUser = session?.user ?? null;
        if (!cancelled) {
          setUser(authUser);
        }

        // 2) Fetch profile if logged in
        if (authUser?.id) {
          const { data, error: pErr } = await supabase.rpc("get_profile_display", {
            p_user_id: authUser.id,
          });

          if (!cancelled) {
            if (pErr) {
              console.warn("[UserContext] profile fetch failed:", pErr.message);
              setProfile(null);
              setAvatar(null);
            } else {
              setProfile(data || null);
              setAvatar(data?.avatar_url || null);
              lastProfileFetchRef.current = Date.now();
            }
          }
        } else {
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
        if (!cancelled) {
          setLoading(false); // ★ full hydration complete
        }
      }
    })();

    /* ------------------------------------------------------------------- */
    /*                  LISTEN TO AUTH STATE CHANGES                       */
    /* ------------------------------------------------------------------- */

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSessionLoaded(true); // ★ ensure app sees session immediately

      setSession(session || null);
      const authUser = session?.user ?? null;
      setUser(authUser);

      // refresh profile
      if (authUser?.id) {
        const { data, error: pErr } = await supabase.rpc("get_profile_display", {
          p_user_id: authUser.id,
        });

        if (pErr) {
          console.warn("[UserContext] profile fetch (auth change) failed:", pErr.message);
          setProfile(null);
          setAvatar(null);
        } else {
          setProfile(data || null);
          setAvatar(data?.avatar_url || null);
          lastProfileFetchRef.current = Date.now();
        }
      } else {
        setProfile(null);
        setAvatar(null);
        setSubscription(null);
      }
    });

    return () => {
      cancelled = true;
      subscription?.unsubscribe?.();
    };
  }, []);

  /* ---------------------------------------------------------------------- */
  /*                   SESSION REHYDRATION ON RESUME                         */
  /* ---------------------------------------------------------------------- */
  const rehydrateSession = useCallback(async () => {
    try {
      const {
        data: { session: nextSession },
        error,
      } = await supabase.auth.getSession();
      if (error) throw error;

      setSessionLoaded(true);
      setSession(nextSession || null);
      const authUser = nextSession?.user ?? null;
      setUser(authUser);

      if (authUser?.id && (!profile || !avatar)) {
        const { data, error: pErr } = await supabase.rpc("get_profile_display", {
          p_user_id: authUser.id,
        });
        if (!pErr) {
          setProfile(data || null);
          setAvatar(data?.avatar_url || null);
          lastProfileFetchRef.current = Date.now();
        }
      }
    } catch (e) {
      console.warn("[UserContext] rehydrate failed:", e?.message || e);
    }
  }, [profile, avatar]);

  useEffect(() => {
    const onFocus = () => {
      rehydrateSession();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        rehydrateSession();
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [rehydrateSession]);

  const isReady = sessionLoaded && !loading;

  /* ---------------------------------------------------------------------- */
  /*                                ROLES                                   */
  /* ---------------------------------------------------------------------- */
  const roles = useMemo(() => [], []);

  const hasRole = useCallback(
    () => false,
    []
  );

  const isPartner = false;

  /* ---------------------------------------------------------------------- */
  /*                           PREMIUM / DIRECTORS CUT                      */
  /* ---------------------------------------------------------------------- */
  // Single source of truth for entitlements: profiles
  const isPremium = false;

  /* ---------------------------------------------------------------------- */
  /*                           UPDATE PROFILE HELPER                         */
  /* ---------------------------------------------------------------------- */
  const saveProfilePatch = useCallback(
    async (patch) => {
      if (!user?.id) return;

      const safePatch = { ...(patch || {}) };
      if (safePatch.theme_preset == null) {
        delete safePatch.theme_preset;
      }

      const { error } = await supabase
        .from("profiles")
        .update(safePatch)
        .eq("id", user.id);

      if (error) {
        console.warn("[UserContext] saveProfilePatch failed:", error.message);
        return;
      }

      const { data, error: pErr } = await supabase.rpc("get_profile_display", {
        p_user_id: user.id,
      });
      if (pErr) {
        console.warn("[UserContext] saveProfilePatch refresh failed:", pErr.message);
        return;
      }
      setProfile(data || null);
      if (data?.avatar_url) setAvatar(data.avatar_url);
    },
    [user?.id, profile]
  );

  /* ---------------------------------------------------------------------- */
  /*                        REFRESH PROFILE (MANUAL)                        */
  /* ---------------------------------------------------------------------- */
  const refreshProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setAvatar(null);
      return null;
    }
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }
    const p = (async () => {
      const { data, error } = await supabase.rpc("get_profile_display", {
        p_user_id: user.id,
      });

      if (error) {
        console.warn("[UserContext] refreshProfile failed:", error.message);
        setProfile(null);
        setAvatar(null);
        return null;
      }

      setProfile(data || null);
      setAvatar(data?.avatar_url || null);
      lastProfileFetchRef.current = Date.now();
      return data || null;
    })();
    refreshInFlightRef.current = p.finally(() => {
      refreshInFlightRef.current = null;
    });
    return refreshInFlightRef.current;
  }, [user?.id]);

  /* ---------------------------------------------------------------------- */
  /*                                LOGOUT                                  */
  /* ---------------------------------------------------------------------- */
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setAvatar(null);
  }, []);

  /* ---------------------------------------------------------------------- */
  /*                          INACTIVITY TIMEOUT                            */
  /* ---------------------------------------------------------------------- */
  const INACTIVITY_MS = 3 * 60 * 60 * 1000; // 3 hours
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    if (!user?.id) return;

    lastActivityRef.current = Date.now();
    let timer = null;

    const schedule = () => {
      clearTimeout(timer);
      const elapsed = Date.now() - lastActivityRef.current;
      const remain = Math.max(1000, INACTIVITY_MS - elapsed);
      timer = setTimeout(() => {
        logout();
      }, remain);
    };

    const mark = () => {
      lastActivityRef.current = Date.now();
      schedule();
    };

    const events = ["pointerdown", "keydown", "touchstart", "scroll", "visibilitychange"];
    events.forEach((evt) => window.addEventListener(evt, mark, { passive: true }));

    schedule();

    return () => {
      clearTimeout(timer);
      events.forEach((evt) => window.removeEventListener(evt, mark));
    };
  }, [user?.id, logout]);

  /* ---------------------------------------------------------------------- */
  /*                         SUBSCRIPTION CACHING                           */
  /* ---------------------------------------------------------------------- */
  const refreshSubscription = useCallback(
    async ({ skipLoading = false } = {}) => {
      if (!user?.id) {
        setSubscription(null);
        return null;
      }
      if (!skipLoading) setSubscriptionLoading(true);
      try {
        const { data, error } = await supabase
          .from("subscriptions")
          .select("id,status,price_id,current_period_start,current_period_end,cancel_at_period_end,updated_at")
          .eq("user_id", user.id)
          .order("current_period_end", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) {
          console.warn("[UserContext] subscription fetch failed:", error.message);
          setSubscription(null);
          return null;
        }
        setSubscription(data || null);
        return data || null;
      } finally {
        if (!skipLoading) setSubscriptionLoading(false);
      }
    },
    [user?.id]
  );

  // Fetch subscription on auth change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        setSubscription(null);
        return;
      }
      const sub = await refreshSubscription({ skipLoading: true });
      if (cancelled) return;
      if (!sub) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, refreshSubscription]);

  // Refresh subscription when tab becomes visible (lightweight)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") refreshSubscription({ skipLoading: true });
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [refreshSubscription]);

  /* ---------------------------------------------------------------------- */
  /*                      STALE PROFILE AUTO-REFRESH                        */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    const STALE_MS = 5 * 60 * 1000;
    const maybeRefresh = () => {
      if (!user?.id) return;
      const last = lastProfileFetchRef.current || 0;
      if (Date.now() - last > STALE_MS) {
        refreshProfile().catch(() => {});
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") maybeRefresh();
    };
    window.addEventListener("focus", maybeRefresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", maybeRefresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshProfile, user?.id]);

  /* ---------------------------------------------------------------------- */
  /*                      PREMIUM DOWNGRADE (TRIAL CHURN)                   */
  /* ---------------------------------------------------------------------- */
  /* ---------------------------------------------------------------------- */
  /*                             PROVIDER VALUE                              */
  /* ---------------------------------------------------------------------- */
  return (
    <UserContext.Provider
      value={{
        user,
        session,
        profile,
        avatar,
        loading,         // full hydration done
        sessionLoaded,   // ★ NEW: session token ready
        roles,
        hasRole,
        isPartner,
        isPremium,
        subscription,
        subscriptionLoading,
        refreshSubscription,
        refreshProfile,
        saveProfilePatch,
        logout,
        isReady,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export { UserProvider };
export default UserProvider;
