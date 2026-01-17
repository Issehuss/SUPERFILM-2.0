import { useEffect, useMemo, useState } from "react";

function isIos() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
}

export default function PwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installing, setInstalling] = useState(false);
  const ios = useMemo(() => isIos(), []);
  const standalone = useMemo(() => isStandalone(), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
      setInstalling(false);
    }
  };

  return (
    <div className="min-h-[70vh] px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-2xl border border-white/10 bg-black/60 p-6">
          <h1 className="text-2xl font-semibold text-white">Install SuperFilm</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Add SuperFilm to your home screen for instant access and a full-screen
            app experience.
          </p>

          {standalone ? (
            <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              You already have SuperFilm installed on this device.
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {deferredPrompt && !ios ? (
                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={installing}
                  className="rounded-full bg-yellow-400 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-300 disabled:opacity-60"
                >
                  {installing ? "Opening installer..." : "Install SuperFilm"}
                </button>
              ) : (
                <span className="text-xs text-zinc-400">
                  Install button appears on supported browsers. It's a pwa btw . App coming soon.
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/50 p-5">
            <h2 className="text-lg font-semibold text-white">iPhone (Safari)</h2>
            <ol className="mt-3 space-y-2 text-sm text-zinc-300">
              <li>1. Open SuperFilm in Safari.</li>
              <li>2. Tap the Share button (square with arrow).</li>
              <li>3. Scroll and tap “Add to Home Screen”.</li>
              <li>4. Tap “Add”.</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/50 p-5">
            <h2 className="text-lg font-semibold text-white">Android (Chrome)</h2>
            <ol className="mt-3 space-y-2 text-sm text-zinc-300">
              <li>1. Open SuperFilm in Chrome.</li>
              <li>2. Tap the “Install SuperFilm” button above.</li>
              <li>3. If you don’t see it, open the menu (⋮).</li>
              <li>4. Tap “Install app” or “Add to Home screen”.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
