import { useEffect, useState } from "react";

export default function PwaUpdateToast() {
  const [registration, setRegistration] = useState(null);

  useEffect(() => {
    function onUpdate(e) {
      const reg = e?.detail?.registration || null;
      if (reg?.waiting) {
        setRegistration(reg);
      }
    }

    window.addEventListener("sf:pwa-update", onUpdate);
    return () => window.removeEventListener("sf:pwa-update", onUpdate);
  }, []);

  if (!registration?.waiting) return null;

  const handleRefresh = () => {
    const waiting = registration.waiting;
    if (!waiting) return;

    const reload = () => window.location.reload();
    navigator.serviceWorker?.addEventListener?.("controllerchange", reload, {
      once: true,
    });

    waiting.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] w-[92%] max-w-md -translate-x-1/2 rounded-2xl border border-yellow-400/30 bg-black/90 px-4 py-3 text-sm text-white shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <span className="text-zinc-200">Update available</span>
        <button
          type="button"
          onClick={handleRefresh}
          className="rounded-full bg-yellow-400 px-3 py-1 text-xs font-semibold text-black hover:bg-yellow-300"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
