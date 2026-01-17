import { useEffect, useMemo, useState } from "react";

const DISMISS_KEY = "sf:pwa-install-dismissed";

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

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const ios = useMemo(() => isIos(), []);
  const standalone = useMemo(() => isStandalone(), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {}

    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (standalone || dismissed) return null;
  if (!deferredPrompt && !ios) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
      dismiss();
    }
  };

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-1/2 z-[60] w-[92%] max-w-md -translate-x-1/2 rounded-2xl border border-yellow-400/30 bg-black/90 px-4 py-3 text-sm text-white shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-white">Install SuperFilm</div>
          <div className="text-xs text-zinc-300 mt-1">
            {ios
              ? "Tap Share, then “Add to Home Screen”."
              : "Add SuperFilm to your home screen for quicker access."}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {deferredPrompt && (
            <button
              type="button"
              onClick={handleInstall}
              className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-semibold text-black hover:bg-yellow-300"
            >
              Add
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-zinc-200 hover:bg-white/10"
            aria-label="Dismiss install prompt"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
