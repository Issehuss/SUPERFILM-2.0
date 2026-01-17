import { useEffect } from "react";

export default function usePerfLogger({ enabled = false, intervalMs = 30000 } = {}) {
  useEffect(() => {
    if (!enabled) return;
    let last = performance.now();
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const now = performance.now();
      const drift = Math.round(now - last - intervalMs);
      last = now;
      const mem = performance?.memory;
      const usedMB = mem ? Math.round(mem.usedJSHeapSize / 1048576) : null;
      const nodes =
        typeof document !== "undefined" ? document.getElementsByTagName("*").length : null;
      // eslint-disable-next-line no-console
      console.info("[perf]", { driftMs: drift, usedMB, nodes });
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);
}
