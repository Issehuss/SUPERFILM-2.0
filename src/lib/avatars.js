export const DEFAULT_USER_AVATAR = "/default-avatar.svg";

export function getUserAvatar(profile) {
  return typeof profile?.avatar_url === "string" && profile.avatar_url.length > 0
    ? profile.avatar_url
    : DEFAULT_USER_AVATAR;
}
