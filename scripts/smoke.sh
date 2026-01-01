#!/usr/bin/env bash
set -euo pipefail

# Simple pre-deploy smoke for critical flows.
# Checks env, Supabase access to events/nominations, and TMDB token/key.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

missing_env=()
[[ -z "${REACT_APP_SUPABASE_URL:-}" ]] && missing_env+=(REACT_APP_SUPABASE_URL)
[[ -z "${REACT_APP_SUPABASE_ANON_KEY:-}" ]] && missing_env+=(REACT_APP_SUPABASE_ANON_KEY)
if [[ -z "${REACT_APP_TMDB_READ_TOKEN:-}" && -z "${REACT_APP_TMDB_API_KEY:-}" && -z "${VITE_TMDB_READ_TOKEN:-}" && -z "${VITE_TMDB_V3_API_KEY:-}" ]]; then
  missing_env+=(TMDB_TOKEN_OR_KEY)
fi

if (( ${#missing_env[@]} )); then
  echo "[SMOKE] Missing env: ${missing_env[*]}" >&2
  exit 1
fi

node - <<'NODE'
import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL;
const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

(async () => {
  try {
    console.log('[SMOKE] checking events table…');
    const { data, error } = await supabase
      .from('events')
      .select('id, slug')
      .limit(1);
    if (error) throw error;
    console.log('[SMOKE] events ok, sample:', data?.[0] || null);
  } catch (e) {
    console.error('[SMOKE] events fetch failed:', e.message || e);
    process.exit(1);
  }

  try {
    console.log('[SMOKE] checking nominations policy…');
    const { error } = await supabase
      .from('nominations')
      .select('count', { count: 'exact', head: true })
      .limit(1);
    if (error) throw error;
    console.log('[SMOKE] nominations ok (select head)');
  } catch (e) {
    console.error('[SMOKE] nominations select failed:', e.message || e);
    process.exit(1);
  }

  // TMDB quick ping using fetch to confirm token/key works
  const token = process.env.REACT_APP_TMDB_READ_TOKEN || process.env.VITE_TMDB_READ_TOKEN;
  const apiKey = process.env.REACT_APP_TMDB_API_KEY || process.env.REACT_APP_TMDB_V3_API_KEY || process.env.VITE_TMDB_V3_API_KEY;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const urlBase = 'https://api.themoviedb.org/3';
  const urlNow = token
    ? `${urlBase}/movie/550`
    : `${urlBase}/movie/550?api_key=${encodeURIComponent(apiKey)}`;
  try {
    console.log('[SMOKE] TMDB check…');
    const res = await fetch(urlNow, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    console.log('[SMOKE] TMDB ok');
  } catch (e) {
    console.error('[SMOKE] TMDB failed:', e.message || e);
    process.exit(1);
  }

  console.log('[SMOKE] all checks passed');
  process.exit(0);
})();
NODE

