// src/utils/profileHref.js
export function profileHref(p) {
    if (!p) return "/profile";
    return p.slug ? `/u/${p.slug}` : `/profile/${p.id}`;
  }
  