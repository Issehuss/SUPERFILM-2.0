// src/lib/env.js
// Unified env helper: works in CRA (REACT_APP_*) and Vite (VITE_*).

let viteEnv = {};
try {
  // CRA will throw here because import.meta isn’t defined
  // Vite will succeed and populate viteEnv
  viteEnv = import.meta.env || {};
} catch {
  viteEnv = {};
}

export const env = {
  SUPABASE_URL:
    process.env.REACT_APP_SUPABASE_URL ??
    viteEnv.VITE_SUPABASE_URL,

  SUPABASE_ANON_KEY:
    process.env.REACT_APP_SUPABASE_ANON_KEY ??
    viteEnv.VITE_SUPABASE_ANON_KEY,

  TMDB_API_KEY:
    process.env.REACT_APP_TMDB_KEY ??
    process.env.REACT_APP_TMDB_API_KEY ??
    viteEnv.VITE_TMDB_API_KEY,
};
