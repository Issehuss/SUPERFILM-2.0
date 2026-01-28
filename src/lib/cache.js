export function readCache(key, ttlMs) {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const at = parsed.at;
    if (!at || typeof at !== "number") return null;

    if (typeof ttlMs === "number" && ttlMs > 0) {
      if (Date.now() - at > ttlMs) return null;
    }

    return parsed.data ?? null;
  } catch {
    return null;
  }
}

export function writeCache(key, data) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* ignore quota/private mode */
  }
}

export function removeCache(key) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
