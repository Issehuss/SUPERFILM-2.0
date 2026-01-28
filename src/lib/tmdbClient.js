// src/lib/tmdbClient.js
import supabase from "lib/supabaseClient";

function _env(k) {
  try { if (typeof import.meta !== "undefined" && import.meta.env && k in import.meta.env) return import.meta.env[k]; } catch {}
  try { if (typeof process !== "undefined" && process.env && k in process.env) return process.env[k]; } catch {}
  return "";
}

export function getTmdbCreds() {
  const v4 = (
    _env("VITE_TMDB_V4_READ_TOKEN") ||
    _env("VITE_TMDB_READ_TOKEN") ||
    _env("VITE_APP_TMDB_READ_TOKEN") ||
    _env("REACT_APP_TMDB_READ_TOKEN") ||
    ""
  ).trim();

  const v3 = (
    _env("VITE_TMDB_V3_API_KEY") ||
    _env("VITE_TMDB_API_KEY") ||
    _env("VITE_APP_TMDB_KEY") ||
    _env("REACT_APP_TMDB_API_KEY") ||
    ""
  ).trim();

  return { v4, v3 };
}

// Normalized: { id, title, year, backdropUrl, posterUrl }
export async function searchMovies(query) {
  const q = String(query || "").trim();
  if (!q) return [];

  const { v4, v3 } = getTmdbCreds();

  // 1) Prefer secure server proxy (no keys in the browser)
  try {
    const { data, error } = await supabase.functions.invoke("tmdb-search", {
      body: { q },
    });
    if (error) throw error;
    if (!data || !Array.isArray(data.results)) throw new Error("Bad proxy response");

    return data.results
      .map((m) => {
        const title = m.title || m.name || "";
        const year = m.release_date ? Number(String(m.release_date).slice(0, 4)) : undefined;
        const backdropUrl = m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : null;
        const posterUrl = m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null;
        if (!title || (!backdropUrl && !posterUrl)) return null;
        return { id: m.id, title, year, backdropUrl, posterUrl };
      })
      .filter(Boolean);
  } catch (proxyErr) {
    console.warn("TMDB proxy failed, checking local env fallback…", proxyErr?.message || proxyErr);
  }

  // 2) Fallback for local dev only (if you set a key in .env.local)
  try {
    const base = "https://api.themoviedb.org/3/search/movie";
    const url = `${base}?query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1`;

    // Prefer v4 bearer; otherwise v3 api_key
    let finalUrl = url;
    let headers = { Accept: "application/json" };
    if (v4) {
      headers = { ...headers, Authorization: `Bearer ${v4}` };
    } else if (v3) {
      finalUrl = `${url}&api_key=${v3}`;
    } else {
      throw new Error("No TMDB key found in env (v4/v3).");
    }

    const res = await fetch(finalUrl, { headers });
    if (!res.ok) {
      const t = await safeText(res);
      throw new Error(`TMDB ${res.status}: ${t}`);
    }

    const data = await res.json();
    const list = Array.isArray(data?.results) ? data.results : [];
    return list
      .map((m) => {
        const title = m.title || m.name || "";
        const year = m.release_date ? Number(String(m.release_date).slice(0, 4)) : undefined;
        const backdropUrl = m.backdrop_path ? `https://image.tmdb.org/t/p/w780${m.backdrop_path}` : null;
        const posterUrl = m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null;
        if (!title || (!backdropUrl && !posterUrl)) return null;
        return { id: m.id, title, year, backdropUrl, posterUrl };
      })
      .filter(Boolean);
  } catch (e) {
    console.error("TMDB search exception:", e);
    return [];
  }
}

async function safeText(res) {
  try { return await res.text(); } catch { return ""; }
}

// Optional helper for images
export function tmdbImage(path, size = "w500") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : "";
}

// src/lib/tmdbClient.js
export async function searchRichImages(query, { premium = false } = {}) {
  const url = `${import.meta.env.VITE_SUPABASE_FUNCTIONS_URL}/tmdb-rich-images?q=${encodeURIComponent(query)}`;
  const r = await fetch(url, {
    headers: {
      "x-premium": premium ? "1" : "0",
    },
  });
  if (!r.ok) throw new Error("tmdb-rich-images failed");
  const { results } = await r.json();
  // Map to a unified item your UI expects
  return (results || []).map((i) => ({
    // You can display using TMDB image base + size:
    // e.g. https://image.tmdb.org/t/p/w1280${i.path}
    backdropUrl: `https://image.tmdb.org/t/p/w1280${i.path}`,
    originalUrl: `https://image.tmdb.org/t/p/original${i.path}`,
    width: i.width,
    height: i.height,
    source: i.source,
    tmdbId: i.tmdb_id,
  }));
}
