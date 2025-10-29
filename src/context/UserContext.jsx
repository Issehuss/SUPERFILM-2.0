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

/**
 * This provider:
 * - Loads auth user and profile on bootstrap and auth changes
 * - Ensures a profiles row exists (inserts a skeleton if missing)
 * - Subscribes to realtime updates for the current user's profile
 * - Exposes saveProfilePatch with optimistic UI + server reconciliation
 */
function UserProvider({ children }) {
  const [user, setUser] = useState(null);          // Supabase auth user
  const [profile, setProfile] = useState(null);    // Row from public.profiles
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ───────────────────────────── Derived flags ───────────────────────────── */
  const isPremium =
    profile?.plan === "directors_cut" || profile?.is_premium === true;

  /* ─────────────────────── Ensure profile row exists ─────────────────────── */
  const ensureProfileExists = useCallback(
    async (uid) => {
      if (!uid) return null;

      // Try to fetch first
      const { data: existing, error: selErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", uid)
        .maybeSingle();

      if (selErr) {
        console.error("[UserContext] ensureProfileExists (select) error:", selErr);
        // don’t throw; continue to try upsert below
      }

      if (existing?.id) return existing;

      // Create a minimal row (RLS must allow INSERT with check id = auth.uid())
      const now = new Date().toISOString();
      const { data: inserted, error: insErr } = await supabase
        .from("profiles")
        .upsert(
          [{ id: uid, updated_at: now }],
          { onConflict: "id" }
        )
        .select("id")
        .maybeSingle();

      if (insErr) {
        console.error("[UserContext] ensureProfileExists (upsert) error:", insErr);
        return null;
      }
      return inserted;
    },
    []
  );

  /* ───────────────────────────── Load profile ────────────────────────────── */
  const loadProfile = useCallback(
    async (uid) => {
      if (!uid) return null;

      // Make sure there is a row to read (prevents "blank until save")
      await ensureProfileExists(uid);

      const { data: prof, error } = await supabase
        .from("profiles")
        .select(`
          id,
          display_name,
          slug,
          avatar_url,
          banner_url,
          banner_gradient,
          theme_preset,
          favorite_films,
          joined_clubs,
          is_partner,
          plan,
          is_premium,
          premium_started_at,
          premium_expires_at,
          cancel_at_period_end,
          taste_cards,
          taste_card_style_global,
          film_takes,
          moodboard
        `)
        .eq("id", uid)
        .maybeSingle();

      if (error) {
        console.error("[UserContext] loadProfile error:", error);
        return null;
      }

      // Keep previous UI if nothing returned (shouldn’t happen after ensure)
      if (prof) {
        setProfile(prof);
        setAvatar(prof.avatar_url || null);
      }
      return prof;
    },
    [ensureProfileExists]
  );

  /* ─────────────────────────── Public refresh API ────────────────────────── */
  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    await loadProfile(user.id);
  }, [user?.id, loadProfile]);

  /* ─────────────────────────────── Logout API ────────────────────────────── */
  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setProfile(null);
      setAvatar(null);
    }
  }, []);

  /* ───────────────────────────── Bootstrap auth ──────────────────────────── */
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        const authUser = sessionData?.session?.user ?? null;
        if (!mounted) return;

        setUser(authUser || null);

        if (authUser?.id) {
          await loadProfile(authUser.id);
        } else {
          setProfile(null);
          setAvatar(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const authUser = session?.user ?? null;
        setUser(authUser || null);

        if (authUser?.id) {
          setLoading(true);
          try {
            await loadProfile(authUser.id);
          } finally {
            setLoading(false);
          }
        } else {
          setProfile(null);
          setAvatar(null);
        }
      }
    );

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, [loadProfile]);

  /* ─────────────────────────── Realtime sync (self) ──────────────────────── */
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profiles:uid=${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new || payload.old;
          if (!row) return;

          // Merge without nuking unknown fields
          setProfile((prev) => ({ ...(prev || {}), ...row }));
          if (row.avatar_url !== undefined) setAvatar(row.avatar_url || null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  /* ────────────────────────── Save (optimistic, safe) ────────────────────── */
  const saveProfilePatch = useCallback(
    async (patch) => {
      if (!user?.id) throw new Error("Not signed in");
      if (!patch || typeof patch !== "object") return null;

      // Optimistic UI
      setProfile((prev) => ({ ...(prev || {}), ...patch }));
      if (Object.prototype.hasOwnProperty.call(patch, "avatar_url")) {
        setAvatar(patch.avatar_url || null);
      }

      const { data, error } = await supabase
        .from("profiles")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .select()
        .maybeSingle();

      if (error) {
        console.error("[UserContext] saveProfilePatch error:", error);
        // Reconcile with server truth to avoid stale optimistic state
        await loadProfile(user.id);
        throw error;
      }

      // Ensure local matches canonical row
      if (data) {
        setProfile((prev) => ({ ...(prev || {}), ...data }));
        if (Object.prototype.hasOwnProperty.call(data, "avatar_url")) {
          setAvatar(data.avatar_url || null);
        }
      }
      return data;
    },
    [user?.id, loadProfile]
  );

  /* ─────────────────────────────── Context value ─────────────────────────── */
  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      avatar,
      setAvatar,          // expose if callers want to pre-preview avatar
      saveProfilePatch,   // persist partial updates
      refreshProfile,     // manual refetch
      isPremium,
      logout,
    }),
    [user, profile, loading, avatar, saveProfilePatch, refreshProfile, isPremium, logout]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export { UserProvider };
export default UserProvider;
