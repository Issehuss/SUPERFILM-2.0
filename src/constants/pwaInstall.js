const PWA_INSTALL_DISMISSED_KEY = "sf:pwa-install-dismissed";
const PWA_INSTALLED_KEY = "sf:pwa-installed";
const PWA_INSTALL_SYNC_EVENT = "sf:pwa-install-sync";

function safeSetItem(key, value) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function dispatchSyncEvent() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PWA_INSTALL_SYNC_EVENT));
}

export function markPwaPromptDismissed() {
  safeSetItem(PWA_INSTALL_DISMISSED_KEY, "1");
  dispatchSyncEvent();
}

export function markPwaInstalled() {
  safeSetItem(PWA_INSTALLED_KEY, "1");
  safeSetItem(PWA_INSTALL_DISMISSED_KEY, "1");
  dispatchSyncEvent();
}

export function getPwaInstallFlags() {
  if (typeof window === "undefined") {
    return { dismissed: false, installed: false };
  }
  return {
    dismissed: localStorage.getItem(PWA_INSTALL_DISMISSED_KEY) === "1",
    installed: localStorage.getItem(PWA_INSTALLED_KEY) === "1",
  };
}

export {
  PWA_INSTALL_DISMISSED_KEY,
  PWA_INSTALLED_KEY,
  PWA_INSTALL_SYNC_EVENT,
};
