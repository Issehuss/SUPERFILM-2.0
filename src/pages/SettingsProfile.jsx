import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Bell, Download, Mail, Shield, Trash2 } from "lucide-react";
import supabase from "lib/supabaseClient";
import { useUser } from "../context/UserContext";
import { env } from "../lib/env";
import { getPushSubscription, subscribeToPush, sendTestPush } from "../lib/push";
import useMyClubs from "../hooks/useMyClubs";

export default function SettingsProfile() {
  const { user, profile, saveProfilePatch } = useUser();
  const navigate = useNavigate();
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [pushStatus, setPushStatus] = useState("default");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const { clubs: myClubs, loading: clubsLoading } = useMyClubs();
  const [savingPrimary, setSavingPrimary] = useState(false);
  const [localPrimaryClubId, setLocalPrimaryClubId] = useState(profile?.primary_club_id || null);

  const defaultPrefs = useMemo(
    () => ({
      club_activity: true,
      mentions: true,
      product_updates: true,
    }),
    []
  );
  const [prefs, setPrefs] = useState(defaultPrefs);

  useEffect(() => {
    setCurrentEmail(user?.email || "");
    const metaPrefs = user?.user_metadata?.notification_prefs;
    if (metaPrefs && typeof metaPrefs === "object") {
      setPrefs({ ...defaultPrefs, ...metaPrefs });
    } else {
      setPrefs(defaultPrefs);
    }
  }, [user?.email, user?.user_metadata?.notification_prefs, defaultPrefs]);

  useEffect(() => {
    setLocalPrimaryClubId(profile?.primary_club_id || null);
  }, [profile?.primary_club_id]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (typeof window === "undefined") return;
      if (!("Notification" in window)) return;
      const permission = Notification.permission;
      if (!mounted) return;
      setPushStatus(permission);
      try {
        const sub = await getPushSubscription();
        if (mounted) setPushEnabled(!!sub);
      } catch {}
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    const next = newEmail.trim().toLowerCase();

    if (!next) {
      toast.error("Enter a new email address.");
      return;
    }
    if (next === currentEmail.toLowerCase()) {
      toast.error("That’s already your current email.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw error;
      toast.success("Check your email to confirm the change.");
      setNewEmail("");
    } catch (err) {
      toast.error(err?.message || "Couldn’t update email.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!currentEmail) {
      toast.error("No email found for your account.");
      return;
    }
    setSendingReset(true);
    try {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/auth/reset` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(currentEmail, {
        redirectTo,
      });
      if (error) throw error;
      toast.success("Password reset link sent. Check your email.");
    } catch (err) {
      toast.error(err?.message || "Couldn’t send reset link.");
    } finally {
      setSendingReset(false);
    }
  };

  const handleSavePrefs = async () => {
    if (!user) return;
    setSavingPrefs(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { notification_prefs: prefs },
      });
      if (error) throw error;
      toast.success("Notification preferences saved.");
    } catch (err) {
      toast.error(err?.message || "Couldn’t save preferences.");
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleSelectPrimary = async (clubId) => {
    if (!user?.id || savingPrimary) return;
    const clearing = clubId === localPrimaryClubId;
    setSavingPrimary(true);
    setLocalPrimaryClubId(clearing ? null : clubId);
    try {
      await saveProfilePatch({ primary_club_id: clearing ? null : clubId });
      if (clearing) {
        toast("Primary club cleared.", { icon: "ℹ️" });
      } else {
        toast.success("Primary club updated.");
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("sf:primary-club:changed", {
            detail: { clubId: clearing ? null : clubId },
          })
        );
      }
    } catch (err) {
      toast.error(err?.message || "Couldn’t save your primary club.");
      setLocalPrimaryClubId(profile?.primary_club_id || null);
    } finally {
      setSavingPrimary(false);
    }
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    try {
      await subscribeToPush();
      setPushEnabled(true);
      setPushStatus("granted");
      toast.success("Push notifications enabled.");
    } catch (err) {
      toast.error(err?.message || "Couldn’t enable push notifications.");
    } finally {
      setPushBusy(false);
    }
  };

  const handleTestPush = async () => {
    setPushBusy(true);
    try {
      await sendTestPush();
      toast.success("Test notification sent.");
    } catch (err) {
      toast.error(err?.message || "Couldn’t send test notification.");
    } finally {
      setPushBusy(false);
    }
  };

  const mailto = (subject, body) => {
    const to = "Kacper@superfilm.info";
    const params = new URLSearchParams({
      subject,
      body,
    });
    window.location.href = `mailto:${to}?${params.toString()}`;
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold mb-4">Profile Settings</h1>
        <div className="rounded-2xl border border-zinc-800 bg-black/40 p-6">
          <p className="text-zinc-300">Please sign in to manage your profile settings.</p>
          <button
            type="button"
            onClick={() => navigate("/auth")}
            className="mt-4 rounded-xl px-4 py-2 bg-zinc-800/70 hover:bg-zinc-700/70 text-zinc-200 ring-1 ring-white/10 transition-colors"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Profile Settings</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Manage your account details, security, and notifications.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-yellow-400/80">
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-400/80" />
          SuperFilm Account
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-black/40 p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Mail className="h-4 w-4 text-yellow-400" />
          Account Email
        </div>
        <div className="text-sm text-zinc-400">Current email</div>
        <div className="text-white font-medium">{currentEmail || "—"}</div>

        <form onSubmit={handleUpdateEmail} className="mt-4 space-y-3">
          <label className="block text-xs uppercase tracking-wide text-zinc-500">
            Change email
          </label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full rounded-lg bg-zinc-900/80 border border-zinc-700 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-yellow-500"
            placeholder="new@email.com"
            autoComplete="email"
          />
          <div className="text-xs text-zinc-500">
            We’ll send a confirmation link to the new email address.
          </div>
          <button
            type="submit"
            disabled={saving}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              saving ? "bg-yellow-700 cursor-wait" : "bg-yellow-500 hover:bg-yellow-400 text-black"
            }`}
          >
            {saving ? "Updating…" : "Update email"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-black/40 p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Shield className="h-4 w-4 text-yellow-400" />
          Security
        </div>
        <div className="text-sm text-zinc-400">
          Send a reset link to update your password.
        </div>
        <button
          type="button"
          onClick={handleSendPasswordReset}
          disabled={sendingReset}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            sendingReset ? "bg-yellow-700 cursor-wait" : "bg-yellow-500 hover:bg-yellow-400 text-black"
          }`}
        >
          {sendingReset ? "Sending…" : "Send password reset link"}
        </button>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-black/40 p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Bell className="h-4 w-4 text-yellow-400" />
          Notifications
        </div>
        <div className="space-y-3 text-sm text-zinc-300">
          {[
            { key: "club_activity", label: "Club activity" },
            { key: "mentions", label: "Mentions & replies" },
            { key: "product_updates", label: "Product updates" },
          ].map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-black/30 px-3 py-2"
            >
              <span>{item.label}</span>
              <input
                type="checkbox"
                checked={!!prefs[item.key]}
                onChange={(e) =>
                  setPrefs((prev) => ({
                    ...prev,
                    [item.key]: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={handleSavePrefs}
          disabled={savingPrefs}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            savingPrefs ? "bg-yellow-700 cursor-wait" : "bg-yellow-500 hover:bg-yellow-400 text-black"
          }`}
        >
          {savingPrefs ? "Saving…" : "Save preferences"}
        </button>

        <div className="mt-4 rounded-xl border border-zinc-800 bg-black/30 p-4">
          <div className="text-sm font-semibold text-zinc-200">Push notifications</div>
          <p className="mt-1 text-xs text-zinc-400">
            Get instant updates from SuperFilm. On iOS, install the app to your home screen
            before enabling push.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={pushBusy || pushEnabled || pushStatus === "denied"}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                pushEnabled
                  ? "bg-white/10 text-zinc-300"
                  : "bg-yellow-500 hover:bg-yellow-400 text-black"
              } ${pushBusy ? "cursor-wait" : ""}`}
            >
              {pushEnabled ? "Enabled" : pushBusy ? "Enabling…" : "Enable notifications"}
            </button>
            {pushStatus === "denied" && (
              <span className="text-xs text-red-300">
                Notifications are blocked in your browser settings.
              </span>
            )}
            {env.IS_DEV && (
              <button
                type="button"
                onClick={handleTestPush}
                disabled={pushBusy}
                className="rounded-lg px-3 py-2 text-xs font-semibold bg-white/10 text-zinc-100 hover:bg-white/15"
              >
                Send test push
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-black/40 p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <Download className="h-4 w-4 text-yellow-400" />
          Account Data
        </div>
        <div className="text-sm text-zinc-400">
          Request a copy of your data or ask to delete your account.
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              mailto(
                "SuperFilm data export request",
                `Hi SuperFilm team,%0D%0A%0D%0AI'd like to request a copy of my data.%0D%0A%0D%0AAccount email: ${currentEmail}%0D%0AUser ID: ${user.id}`
              )
            }
            className="rounded-lg px-4 py-2 text-sm font-semibold bg-white/10 text-zinc-100 hover:bg-white/15"
          >
            Request data export
          </button>
          <button
            type="button"
            onClick={() =>
              mailto(
                "SuperFilm account deletion request",
                `Hi SuperFilm team,%0D%0A%0D%0AI'd like to request deletion of my account.%0D%0A%0D%0AAccount email: ${currentEmail}%0D%0AUser ID: ${user.id}`
              )
            }
            className="rounded-lg px-4 py-2 text-sm font-semibold border border-red-500/40 text-red-200 hover:bg-red-500/10"
          >
            <span className="inline-flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Request account deletion
            </span>
          </button>
        </div>
      </section>
      <section className="rounded-2xl border border-zinc-800 bg-black/40 p-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <span className="h-4 w-4 rounded-full bg-emerald-500" />
            Club Settings
          </div>
          <p className="text-xs text-zinc-400 max-w-[30ch] text-right">
            Highlight one club as your primary club for Home, leaderboard, and dropdown indicators.
          </p>
        </div>
        {clubsLoading && !myClubs.length ? (
          <div className="text-sm text-zinc-400">Loading clubs…</div>
        ) : !myClubs.length ? (
          <div className="text-sm text-zinc-400">
            You’re not a member of any clubs yet. Join a club to feature it here.
          </div>
        ) : (
          <div className="space-y-2">
            {myClubs.map((clubOption) => {
              const isPrimary = clubOption.id === localPrimaryClubId;
              return (
                <button
                  key={clubOption.id}
                  type="button"
                  onClick={() => handleSelectPrimary(clubOption.id)}
                  disabled={savingPrimary && !isPrimary}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition focus:outline-none ${
                    isPrimary
                      ? "border-emerald-500/70 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                      : "border-white/10 bg-transparent hover:border-white/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <span>{clubOption.name}</span>
                        {isPrimary && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">ID: {clubOption.id}</div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <span
                        className={`h-3 w-3 rounded-full border ${
                          isPrimary ? "bg-emerald-400 border-emerald-300" : "border-white/30"
                        }`}
                      />
                      <span>{isPrimary ? "Featured club" : "Set as primary"}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <p className="text-xs text-zinc-500">
          This choice is read-only elsewhere on the site and only determines which club is highlighted.
        </p>
      </section>
    </div>
  );
}
