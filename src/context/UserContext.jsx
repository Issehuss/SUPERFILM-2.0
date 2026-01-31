import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import supabase, { refreshSupabaseSession } from "lib/supabaseClient";
import useAppResume from "../hooks/useAppResume";

const SESSION_THROTTLE_MS = 30 * 1000;
const PROFILE_COOLDOWN_MS = 3 * 1000;
const PROFILE_STALE_MS = 5 * 60 * 1000;
const SUBSCRIPTION_STALE_MS = 5 * 60 * 1000;
const INACTIVITY_MS = 60 * 60 * 1000;

const UserContext = createContext(null);
const MembershipRefreshContext = createContext({
  membershipEpoch: 0,
  bumpMembership: () => {},
});

export const useUser = () => useContext(UserContext);
export const useMembershipRefresh = () => useContext(MembershipRefreshContext);

function UserProvider({ children }) {
  const [user, setUser] = useState(null);            // supabase.auth user
  const [session, setSession] = useState(null);      // supabase.auth session
  const [profile, setProfile] = useState(null);      // row in profiles
  const [avatar, setAvatar] = useState(null);        // convenience
  const [loading, setLoading] = useState(true);      // full hydration state
  const [sessionLoaded, setSessionLoaded] = useState(false); // ★ new — token restored
  const [subscription, setSubscription] = useState(null); // cached subscription row
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [membershipEpoch, setMembershipEpoch] = useState(0);
  const lastProfileFetchRef = useRef({});
  const refreshInFlightRef = useRef({});
  const subscriptionInFlightRef = useRef(null);
  const lastSessionCheckRef = useRef(0);
  const lastSubscriptionFetchRef = useRef(0);
  const profileRef = useRef(null);
  const subscriptionRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const { appResumeTick, ready: resumeReady } = useAppResume();
  const lastResumeTickRef = useRef(appResumeTick);
  const [myClubIds, setMyClubIds] = useState([]);
  const myClubIdsRef = useRef([]);
  const membershipsInFlightRef = useRef(null);
  const lastMembershipFetchRef = useRef(0);
  const MEMBERSHIP_STALE_MS = 30 * 1000;

  const isOffline = useCallback(
    () =>
      typeof navigator !== "undefined" &&
      typeof navigator.onLine !== "undefined" &&
      !navigator.onLine,
    []
  );

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    subscriptionRef.current = subscription;
  }, [subscription]);

  useEffect(() => {
    myClubIdsRef.current = myClubIds;
  }, [myClubIds]);

  const restoreSession = useCallback(
    async ({ force = false, reason = "resume" } = {}) => {
      if (isOffline()) {
        console.warn(`[UserContext] session restore (${reason}) skipped (offline)`);
        // sessionLoaded here means "auth check attempt finished or skipped due to offline"
        setSessionLoaded(true);
        return null;
      }
      const now = Date.now();
      if (!force && now - lastSessionCheckRef.current < SESSION_THROTTLE_MS) {
        return null;
      }
      lastSessionCheckRef.current = now;
      try {
        const {
          data: { session: nextSession },
          error,
        } = await supabase.auth.getSession();
        setSessionLoaded(true);
        if (error) {
          console.warn(`[UserContext] session restore (${reason}) failed:`, error.message);
          return null;
        }
        setSession(nextSession || null);
        const authUser = nextSession?.user ?? null;
        setUser(authUser);
        if (!authUser) {
          setProfile(null);
          setAvatar(null);
          setSubscription(null);
          lastSubscriptionFetchRef.current = 0;
        }
        return authUser;
      } catch (err) {
        console.warn(`[UserContext] session restore (${reason}) error:`, err?.message || err);
        return null;
      }
    },
    [isOffline]
  );

  const fetchProfileDisplay = useCallback(
    async (userId, { reason = "unknown", force = false } = {}) => {
      if (!userId) return null;
      if (isOffline()) {
        console.warn(`[UserContext] profile fetch (${reason}) skipped (offline)`);
        return profileRef.current;
      }
      const meta = refreshInFlightRef.current;
      const now = Date.now();
      const lastSuccess = lastProfileFetchRef.current[userId] || 0;
      if (!force && now - lastSuccess < PROFILE_COOLDOWN_MS) {
        return profileRef.current;
      }
      if (meta[userId]) {
        return meta[userId];
      }
      const promise = (async () => {
        const { data, error } = await supabase.rpc("get_profile_display", {
          p_user_id: userId,
        });
        if (error) {
          console.warn(`[UserContext] profile fetch (${reason}) failed:`, error.message);
          return profileRef.current;
        }
        const row = Array.isArray(data) ? data[0] : data;

setProfile(row || null);
setAvatar(row?.avatar_url || null);

        lastProfileFetchRef.current[userId] = Date.now();
        return data || null;
      })();
      meta[userId] = promise;
      try {
        return await promise;
      } finally {
        if (meta[userId] === promise) {
          delete meta[userId];
        }
      }
    },
    [isOffline]
  );

  const refreshProfile = useCallback(
    async ({ force } = {}) => {
      if (!user?.id) return null;
      return fetchProfileDisplay(user.id, {
        reason: "manual-refresh",
        force: !!force,
      });
    },
    [user?.id, fetchProfileDisplay]
  );

  const refreshSubscription = useCallback(
    async ({ skipLoading = false, force = false } = {}) => {
      const userId = user?.id || null;
      if (!userId) {
        setSubscription(null);
        lastSubscriptionFetchRef.current = 0;
        return null;
      }
      if (isOffline()) {
        if (!skipLoading) {
          console.warn("[UserContext] subscription refresh skipped (offline)");
        }
        return subscriptionRef.current;
      }
      const now = Date.now();
      if (!force && now - lastSubscriptionFetchRef.current < SUBSCRIPTION_STALE_MS) {
        return subscriptionRef.current;
      }
      if (subscriptionInFlightRef.current) {
        return subscriptionInFlightRef.current;
      }
      if (!skipLoading) {
        setSubscriptionLoading(true);
      }
      const fetchPromise = (async () => {
        const { data, error } = await supabase
          .from("subscriptions")
          .select(
            "id,status,price_id,current_period_start,current_period_end,cancel_at_period_end,updated_at"
          )
          .eq("user_id", userId)
          .order("current_period_end", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) {
          console.warn("[UserContext] subscription fetch failed:", error.message);
          return subscriptionRef.current;
        }
        lastSubscriptionFetchRef.current = Date.now();
        setSubscription(data || null);
        return data || null;
      })();
      subscriptionInFlightRef.current = fetchPromise;
      try {
        return await fetchPromise;
      } finally {
        subscriptionInFlightRef.current = null;
        if (!skipLoading) {
          setSubscriptionLoading(false);
        }
      }
    },
    [user?.id, isOffline]
  );

  const loadMyMemberships = useCallback(
    async ({ reason = "unknown", force = false } = {}) => {
      const userId = user?.id || null;
      if (!userId) {
        setMyClubIds([]);
        lastMembershipFetchRef.current = 0;
        return [];
      }
      if (isOffline()) {
        console.warn(`[UserContext] memberships fetch (${reason}) skipped (offline)`);
        return myClubIdsRef.current;
      }
      const now = Date.now();
      if (!force && now - lastMembershipFetchRef.current < MEMBERSHIP_STALE_MS) {
        return myClubIdsRef.current;
      }
      if (membershipsInFlightRef.current) {
        return membershipsInFlightRef.current;
      }
      const promise = (async () => {
        const { data, error } = await supabase
          .from("club_members")
          .select("club_id, accepted")
          .eq("user_id", userId)
          .eq("accepted", true);
        if (error) {
          console.warn(`[UserContext] memberships fetch (${reason}) failed:`, error.message);
          return myClubIdsRef.current;
        }
        const ids = (data || []).map((row) => String(row.club_id));
        setMyClubIds(ids);
        lastMembershipFetchRef.current = Date.now();
        return ids;
      })();

      membershipsInFlightRef.current = promise;
      try {
        return await promise;
      } finally {
        membershipsInFlightRef.current = null;
      }
    },
    [user?.id, isOffline]
  );

  const handleResume = useCallback(async () => {
    if (isOffline()) return;
    await refreshSupabaseSession();
    const authUser = await restoreSession({ reason: "resume" });
    if (!authUser?.id) return;
    const lastProfile = lastProfileFetchRef.current[authUser.id] || 0;
    if (Date.now() - lastProfile > PROFILE_STALE_MS) {
      fetchProfileDisplay(authUser.id, { reason: "resume" });
    }
    if (Date.now() - lastSubscriptionFetchRef.current > SUBSCRIPTION_STALE_MS) {
      refreshSubscription({ skipLoading: true });
    }
    loadMyMemberships({ reason: "resume" });
  }, [isOffline, restoreSession, fetchProfileDisplay, refreshSubscription]);

  /* ---------------------------------------------------------------------- */
  /*                           INITIAL HYDRATION                            */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isOffline()) {
        console.warn("[UserContext] init skipped (offline)");
        if (!cancelled) {
          setSessionLoaded(true);
          setLoading(false);
        }
        return;
      }
      const authUser = await restoreSession({ force: true, reason: "initial" });
      if (cancelled) return;
      setLoading(false);
      if (authUser?.id) {
        fetchProfileDisplay(authUser.id, { reason: "initial" });
        loadMyMemberships({ reason: "initial", force: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchProfileDisplay, isOffline, restoreSession]);

  /* ------------------------------------------------------------------- */
  /*                  LISTEN TO AUTH STATE CHANGES                       */
  /* ------------------------------------------------------------------- */
  useEffect(() => {
    const {
      data: { subscription: subscriptionHandle },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSessionLoaded(true);
      setSession(nextSession || null);
      const authUser = nextSession?.user ?? null;
      setUser(authUser);
      if (authUser?.id) {
        fetchProfileDisplay(authUser.id, { reason: "authStateChange" });
        refreshSubscription({ skipLoading: true, force: true });
        loadMyMemberships({ reason: "authStateChange", force: true });
      } else {
        setProfile(null);
        setAvatar(null);
        setSubscription(null);
        lastSubscriptionFetchRef.current = 0;
        setMyClubIds([]);
        lastMembershipFetchRef.current = 0;
      }
    });
    return () => {
      subscriptionHandle?.unsubscribe?.();
    };
  }, [fetchProfileDisplay, refreshSubscription]);

  /* ---------------------------------------------------------------------- */
  /*                      RESUME / VISIBILITY / FOCUS                      */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (!resumeReady || !sessionLoaded || !user?.id) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    if (appResumeTick === lastResumeTickRef.current) return;
    lastResumeTickRef.current = appResumeTick;
    handleResume();
  }, [appResumeTick, resumeReady, sessionLoaded, user?.id, handleResume]);

  /* ---------------------------------------------------------------------- */
  /*                         SUBSCRIPTION CACHING                           */
  /* ---------------------------------------------------------------------- */
  useEffect(() => {
    if (!user?.id) return;
    refreshSubscription({ skipLoading: true, force: true });
  }, [user?.id, refreshSubscription]);

  useEffect(() => {
    if (!sessionLoaded || !user?.id) return;
    refreshProfile?.();
  }, [sessionLoaded, user?.id, refreshProfile]);

  useEffect(() => {
    if (!user?.id || !sessionLoaded) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

    const userId = user.id;
    const channel = supabase
      .channel(`club-members:user:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_members",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          lastMembershipFetchRef.current = 0;
          loadMyMemberships({ reason: "realtime", force: true });
          setMembershipEpoch((epoch) => epoch + 1);
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [user?.id, sessionLoaded, loadMyMemberships]);

  /* ---------------------------------------------------------------------- */
  /*                         REFRESH PROFILE (MANUAL)                        */
  /* ---------------------------------------------------------------------- */
  const bumpMembership = useCallback(() => {
    setMembershipEpoch((epoch) => epoch + 1);
  }, []);

  useEffect(() => {
    if (!user?.id || !sessionLoaded) return;
    loadMyMemberships({ reason: "membershipEpoch" });
  }, [membershipEpoch, user?.id, sessionLoaded, loadMyMemberships]);

  const saveProfilePatch = useCallback(
    async (patch) => {
      if (!user?.id) return;

      const safePatch = { ...(patch || {}) };
      if (safePatch.theme_preset == null) {
        delete safePatch.theme_preset;
      }

      setProfile((prev) => (prev ? { ...prev, ...safePatch } : prev));

      const { error } = await supabase
        .from("profiles")
        .update(safePatch)
        .eq("id", user.id);

      if (error) {
        console.warn("[UserContext] saveProfilePatch failed:", error.message);
        return;
      }

      await fetchProfileDisplay(user.id, { reason: "saveProfilePatch", force: true });
    },
    [user?.id, fetchProfileDisplay]
  );

  /* ---------------------------------------------------------------------- */
  /*                                LOGOUT                                  */
  /* ---------------------------------------------------------------------- */
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setAvatar(null);
    setSubscription(null);
    lastSubscriptionFetchRef.current = 0;
  }, []);

  /* ---------------------------------------------------------------------- */
  /*                          INACTIVITY TIMEOUT                            */
  /* ---------------------------------------------------------------------- */
  const isReady = sessionLoaded && !loading;

  useEffect(() => {
    if (!user?.id || !isReady) return;
    if (typeof window === "undefined") return;

    let timerId;

    function scheduleLogout(delay = INACTIVITY_MS) {
      if (timerId) {
        window.clearTimeout(timerId);
      }
      timerId = window.setTimeout(() => {
        const idleTime = Date.now() - lastActivityRef.current;
        if (idleTime >= INACTIVITY_MS) {
          logout();
          return;
        }
        const nextDelay = Math.max(INACTIVITY_MS - idleTime, 0);
        scheduleLogout(nextDelay);
      }, delay);
    }

    function recordActivity() {
      lastActivityRef.current = Date.now();
      scheduleLogout();
    }

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, { passive: true });
    });

    lastActivityRef.current = Date.now();
    scheduleLogout();

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });
      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
  }, [isReady, user?.id, logout]);

  /* ---------------------------------------------------------------------- */
  /*                                ROLES                                   */
  /* ---------------------------------------------------------------------- */
  const roles = useMemo(() => [], []);

  const hasRole = useCallback(
    () => false,
    []
  );

  const isPartner = false; // TODO: wire partner flag once roles are available

  /* ---------------------------------------------------------------------- */
  /*                           PREMIUM / DIRECTORS CUT                      */
  /* ---------------------------------------------------------------------- */
  const isPremium = useMemo(
    () =>
      profile?.plan === "directors_cut" ||
      profile?.is_premium === true,
    [profile?.plan, profile?.is_premium]
  );

  /* ---------------------------------------------------------------------- */
  /*                           UPDATE PROFILE HELPER                         */
  /* ---------------------------------------------------------------------- */

  return (
        <MembershipRefreshContext.Provider value={{ membershipEpoch, bumpMembership }}>
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
          membershipEpoch,
          bumpMembership,
          myClubIds,
          isMemberOfClub: (clubId) => {
            if (!clubId) return false;
            return myClubIdsRef.current.includes(String(clubId));
          },
          loadMyMemberships,
        }}
      >
        {children}
      </UserContext.Provider>
    </MembershipRefreshContext.Provider>
  );
}

export { UserProvider };
export default UserProvider;
