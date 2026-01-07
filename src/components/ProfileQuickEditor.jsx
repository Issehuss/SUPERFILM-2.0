// src/components/ProfileQuickEditor.jsx
import { useState, useEffect } from "react";
import { useUser } from "../context/UserContext";
import supabase from "../supabaseClient";
import uploadAvatar from "../lib/uploadAvatar";

/**
 * Props:
 *  - onUpdated?: (patch) => void   // optional: parent can patch UI immediately
 */
export default function ProfileQuickEditor({ onUpdated }) {
  const { user, refreshProfile } = useUser();

  // Basics (DB: profiles.display_name, profiles.username, profiles.bio, profiles.club_tag)
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [clubTag, setClubTag] = useState("");

  // UI
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [usernameWarning, setUsernameWarning] = useState("");

  // Load existing basics (incl. username + username meta)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "display_name, username, bio, club_tag, avatar_url, created_at, username_last_changed_at, username_changes_in_window, username_window_started_at"
        )
        .eq("id", user.id)
        .single();

      if (cancelled || error) return;

      setDisplayName(data?.display_name || user?.name || "");
      setUsername(data?.username || "");
      setBio(data?.bio || "");
      setClubTag(data?.club_tag || "");

      // Precompute warning if the *next* change is the last in window
      const warn = computeLastChanceWarning({
        created_at: data?.created_at,
        username_window_started_at: data?.username_window_started_at,
        username_changes_in_window: data?.username_changes_in_window ?? 0,
      });
      setUsernameWarning(warn || "");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.name]);

  /* ---------------- Username policy helpers ---------------- */

  function within90d(iso) {
    if (!iso) return false;
    const ms = 90 * 24 * 60 * 60 * 1000;
    return Date.now() - new Date(iso).getTime() < ms;
  }

  function computeLastChanceWarning(meta) {
    const { created_at, username_window_started_at, username_changes_in_window } = meta || {};
    const inFirst90 = within90d(created_at);
    const windowActive = within90d(username_window_started_at);
    const changes = windowActive ? (username_changes_in_window ?? 0) : 0;
    const limit = inFirst90 ? 2 : 1;

    if (changes + 1 === limit) {
      return inFirst90
        ? "Heads up: this will be your last username change in your first 90 days."
        : "Heads up: this will be your last username change in this 90-day window.";
    }
    return "";
  }

  async function maybeChangeUsername(nextUsername) {
    const { data: prof, error } = await supabase
      .from("profiles")
      .select(
        "username, created_at, username_last_changed_at, username_changes_in_window, username_window_started_at"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;

    const createdAt = prof?.created_at;
    const inFirst90 = within90d(createdAt);

    let windowStart = prof?.username_window_started_at;
    let changes = prof?.username_changes_in_window ?? 0;

    // reset/roll window if expired or not set
    if (!windowStart || !within90d(windowStart)) {
      windowStart = new Date().toISOString();
      changes = 0;
    }

    // limits
    const limit = inFirst90 ? 2 : 1;
    if (changes >= limit) {
      throw new Error(
        inFirst90
          ? "You’ve used both username changes allowed in your first 90 days."
          : "You’ve already changed your username in this 90-day window."
      );
    }

    const isLastChance = changes + 1 === limit;

    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        username: nextUsername,
        username_last_changed_at: new Date().toISOString(),
        username_changes_in_window: changes + 1,
        username_window_started_at: windowStart,
      })
      .eq("id", user.id);

    if (updErr) throw updErr;

    return { isLastChance };
  }

  /* ---------------- Avatar upload ---------------- */

  async function handleAvatarPick(e) {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    setError(""); setOk(""); setUploading(true);
    try {
      const prevUrl = user?.profileAvatarUrl || null;
      // IMPORTANT: capture the URL returned by uploadAvatar
      const newUrl = await uploadAvatar(file, user.id, { prevUrl });
      await refreshProfile();
      setOk("Profile picture updated.");

      // Let parent patch immediately (use the actual newUrl)
      onUpdated?.({ avatar_url: newUrl });
    } catch (err) {
      setError(err?.message || "Failed to upload avatar.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  /* ---------------- Save basics ---------------- */

  async function handleSave() {
    if (!user?.id) return;
    setSaving(true); setError(""); setOk(""); setUsernameWarning("");

    try {
      const cleanDisplay = (displayName || "").trim();
      if (cleanDisplay.length < 2 || cleanDisplay.length > 40) {
        throw new Error("Display name must be 2–40 characters.");
      }

      // 1) Save display_name, bio, club_tag
      {
        const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          display_name: cleanDisplay,
          bio: bio ?? null,
          club_tag: clubTag ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });
      
      if (error) {
        console.error("[profiles upsert basics]", error);
        throw error;
      }
       

        onUpdated?.({
          display_name: cleanDisplay,
          bio: bio ?? null,
          club_tag: clubTag ?? null,
        });
      }

      // 2) Username change (if different)
      if (username && typeof username === "string") {
        const { data: current } = await supabase
          .from("profiles")
          .select(
            "username, created_at, username_window_started_at, username_changes_in_window"
          )
          .eq("id", user.id)
          .maybeSingle();

        const next = username.trim();
        if ((current?.username || "") !== next) {
          const { isLastChance } = await maybeChangeUsername(next);
          if (isLastChance) {
            setUsernameWarning(
              computeLastChanceWarning({
                created_at: current?.created_at,
                username_window_started_at: current?.username_window_started_at,
                username_changes_in_window: (current?.username_changes_in_window ?? 0) + 1,
              }) || ""
            );
          }
          onUpdated?.({ username: next });
        }
      }

      await refreshProfile();
      setOk("Profile saved.");
    } catch (err) {
      setError(err?.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto rounded-2xl bg-neutral-900/60 border border-neutral-800 p-4 sm:p-6 backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-lg font-semibold">Edit Profile</h3>
        <div className="text-xs text-neutral-400">
          Changes update instantly across your profile and chat.
        </div>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6">
        <AvatarPreview />
        <label className="inline-flex items-center gap-2 text-sm font-medium underline cursor-pointer">
          {uploading ? "Uploading..." : "Change avatar"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarPick}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Display name */}
      <div className="mb-4">
        <label className="block text-sm text-neutral-300 mb-1">Display name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Your display name"
          className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-white placeholder-neutral-500 outline-none focus:border-yellow-400"
        />
      </div>

      {/* Username (policy enforced) */}
      <div className="mb-4">
        <label className="block text-sm text-neutral-300 mb-1">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => { setUsername(e.target.value); setUsernameWarning(""); }}
          placeholder="e.g., cinemaava"
          className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-white placeholder-neutral-500 outline-none focus:border-yellow-400"
        />
        {usernameWarning && (
          <p className="text-xs text-yellow-300 mt-1">{usernameWarning}</p>
        )}
        <p className="text-[11px] text-neutral-500 mt-1">
          You can change your username up to 2 times within your first 90 days, then once every 90 days.
        </p>
      </div>

      {/* Club tag */}
      <div className="mb-4">
        <label className="block text-sm text-neutral-300 mb-1">Club tag</label>
        <input
          type="text"
          value={clubTag}
          onChange={(e) => setClubTag(e.target.value)}
          placeholder="e.g., Film Poets"
          className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-white placeholder-neutral-500 outline-none focus:border-yellow-400"
        />
      </div>

      {/* Bio */}
      <div className="mb-6">
        <label className="block text-sm text-neutral-300 mb-1">Bio</label>
        <textarea
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell people about your taste in films…"
          className="w-full rounded-xl bg-neutral-800 border border-neutral-700 px-3 py-2 text-white placeholder-neutral-500 outline-none focus:border-yellow-400"
        />
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-yellow-400 text-black font-semibold px-4 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {ok && <span className="text-green-400 text-sm">{ok}</span>}
        {error && <span className="text-red-400 text-sm">{error}</span>}
      </div>
    </div>
  );
}

/** Shows the user's current avatar using context */
function AvatarPreview() {
  const { user, avatar } = useUser();
  // Prefer DB avatar from context (user.profileAvatarUrl), fallback to local override
  const src = user?.profileAvatarUrl || avatar || "/default-avatar.svg";
  const alt = user?.name || "Avatar";

  return (
    <img
      src={src}
      alt={alt}
      className="h-16 w-16 rounded-full object-cover border border-neutral-700"
    />
  );
}
