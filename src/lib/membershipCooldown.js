const LEFT_COOLDOWN_MS = 10 * 60 * 1000;
const LEFT_CLUB_KEY_PREFIX = "sf:leftClub";

function leftClubKey(clubId) {
  if (!clubId) return null;
  return `${LEFT_CLUB_KEY_PREFIX}:${clubId}`;
}

export function markClubLeft(clubId) {
  if (typeof window === "undefined") return;
  const key = leftClubKey(clubId);
  if (!key) return;
  try {
    sessionStorage.setItem(key, String(Date.now()));
  } catch {}
}

export function hasRecentlyLeftClub(clubId) {
  if (typeof window === "undefined") return false;
  const key = leftClubKey(clubId);
  if (!key) return false;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return false;
    const ts = Number(raw);
    if (!ts || Number.isNaN(ts)) return false;
    return Date.now() - ts < LEFT_COOLDOWN_MS;
  } catch {
    return false;
  }
}
