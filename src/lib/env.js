// src/lib/env.js
// Works in both CRA (webpack) and Vite.

const vite = (typeof import.meta !== "undefined" && import.meta.env) || null;

const pick = (...vals) => {
  for (const v of vals) if (v != null && v !== "") return String(v).trim();
  return "";
};
const toBool = (v, def = false) => {
  if (v === true || v === false) return v;
  if (v == null || v === "") return def;
  const s = String(v).toLowerCase().trim();
  return ["1", "true", "yes", "on"].includes(s);
};

export const env = {
  // --- Supabase ---
  SUPABASE_URL: pick(
    vite && vite.VITE_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL
  ),
  SUPABASE_ANON_KEY: pick(
    vite && vite.VITE_SUPABASE_ANON_KEY,
    process.env.REACT_APP_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ),
  // Optional override. If empty, supabase-js v2 will default to <SUPABASE_URL>/functions/v1
  SUPABASE_FUNCTIONS_URL: pick(
    vite && vite.VITE_SUPABASE_FUNCTIONS_URL,
    process.env.REACT_APP_SUPABASE_FUNCTIONS_URL,
    process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL
  ),

  // --- TMDB ---
  TMDB_READ_TOKEN: pick(
    vite && (vite.VITE_TMDB_READ_TOKEN || vite.VITE_TMDB_V4_READ_TOKEN),
    process.env.REACT_APP_TMDB_READ_TOKEN,
    process.env.REACT_APP_TMDB_V4_READ_TOKEN,
    process.env.NEXT_PUBLIC_TMDB_READ_TOKEN,
    process.env.NEXT_PUBLIC_TMDB_V4_READ_TOKEN
  ),
  TMDB_API_KEY: pick(
    vite && (vite.VITE_TMDB_API_KEY || vite.VITE_TMDB_V3_API_KEY || vite.VITE_TMDB_KEY),
    process.env.REACT_APP_TMDB_API_KEY,
    process.env.REACT_APP_TMDB_V3_API_KEY,
    process.env.REACT_APP_TMDB_KEY,
    process.env.NEXT_PUBLIC_TMDB_API_KEY,
    process.env.NEXT_PUBLIC_TMDB_V3_API_KEY,
    process.env.NEXT_PUBLIC_TMDB_KEY
  ),
  TMDB_API_BASE: pick(
    vite && vite.VITE_TMDB_API_BASE,
    process.env.REACT_APP_TMDB_API_BASE,
    process.env.NEXT_PUBLIC_TMDB_API_BASE
  ) || "https://api.themoviedb.org/3",
  TMDB_IMAGE_BASE: pick(
    vite && vite.VITE_TMDB_IMAGE_BASE,
    process.env.REACT_APP_TMDB_IMAGE_BASE,
    process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE
  ) || "https://image.tmdb.org/t/p",

  // --- Feature / Region flags ---
  ENABLE_CURATIONS: toBool(
    pick(
      vite && (vite.VITE_ENABLE_CURATIONS ?? vite.ENABLE_CURATIONS),
      process.env.REACT_APP_ENABLE_CURATIONS,
      process.env.NEXT_PUBLIC_ENABLE_CURATIONS
    ),
    false
  ),
  REGION: pick(
    vite && (vite.VITE_REGION || vite.VITE_DEFAULT_REGION),
    process.env.REACT_APP_REGION,
    process.env.NEXT_PUBLIC_REGION
  ) || "GB",
  LANGUAGE: pick(
    vite && (vite.VITE_LANGUAGE || vite.VITE_DEFAULT_LANGUAGE),
    process.env.REACT_APP_LANGUAGE,
    process.env.NEXT_PUBLIC_LANGUAGE
  ) || "en-GB",

  // --- Mode flags ---
  NODE_ENV: (vite && vite.MODE) || process.env.NODE_ENV || "development",
  IS_DEV: !!((vite && vite.DEV) || process.env.NODE_ENV === "development"),

  // --- Beta gate ---
  BETA_PASSWORD: pick(
    vite && vite.VITE_BETA_PASSWORD,
    process.env.REACT_APP_BETA_PASSWORD,
    process.env.NEXT_PUBLIC_BETA_PASSWORD
  ),
  BETA_BYPASS: toBool(
    pick(
      vite && (vite.VITE_BETA_BYPASS ?? vite.BETA_BYPASS),
      process.env.REACT_APP_BETA_BYPASS,
      process.env.NEXT_PUBLIC_BETA_BYPASS
    ),
    false
  ),
};

/**
 * TMDB request helpers
 */
export function tmdbHeaders() {
  // Prefer v4 read token (Bearer), else use v3 API key.
  if (env.TMDB_READ_TOKEN) {
    return { Authorization: `Bearer ${env.TMDB_READ_TOKEN}` };
  }
  if (env.TMDB_API_KEY) {
    return {}; // v3 uses ?api_key=...
  }
  return {};
}

export function hasTmdbAuth() {
  return !!(env.TMDB_READ_TOKEN || env.TMDB_API_KEY);
}

export function missingCriticalEnv() {
  const missing = [];
  if (!env.SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!env.SUPABASE_ANON_KEY) missing.push("SUPABASE_ANON_KEY");
  if (!env.TMDB_READ_TOKEN && !env.TMDB_API_KEY) missing.push("TMDB_READ_TOKEN / TMDB_API_KEY");
  return missing;
}
