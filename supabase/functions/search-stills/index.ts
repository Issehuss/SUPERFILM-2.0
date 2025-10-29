
// bump: force redeploy (pick up verify_jwt=false)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

/**
 * env you need to set in Supabase:
 * - TMDB_READ_TOKEN (preferred, v4 bearer)  OR  TMDB_API_KEY (v3 key)
 * - ALLOWED_ORIGINS (comma-separated list of allowed origins)
 */

const TMDB_READ_TOKEN = Deno.env.get("TMDB_READ_TOKEN") ?? "";
const TMDB_API_KEY    = Deno.env.get("TMDB_API_KEY") ?? "";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map(s => s.trim()).filter(Boolean);

const IMG_BASE = "https://image.tmdb.org/t/p";
const POSTER_SIZE   = "w342";
const BACKDROP_SIZE = "w780";

function corsHeaders(req: Request) {
    const origin = req.headers.get("origin") || "";
    const allowed = ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : ["*"];
    const allowThisOrigin =
      allowed.includes("*") || allowed.includes(origin);
  
    return {
      "Access-Control-Allow-Origin": allowThisOrigin ? origin || "*" : "null",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    };
  }
  

serve(async (req: Request) => {
  // CORS preflight & health
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method === "GET") {
    return new Response("ok", { status: 200, headers: corsHeaders(req) });
  }

  try {
    const { q } = await req.json().catch(() => ({ q: "" }));
    const query = String(q || "").trim();
    if (!query) {
      return json(req, 200, { results: [] });
    }

    // Prefer v4 bearer token; else v3 api_key
    let url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;

    const headers: Record<string, string> = { "Accept": "application/json" };
    if (TMDB_READ_TOKEN) {
      headers["Authorization"] = `Bearer ${TMDB_READ_TOKEN}`;
    } else if (TMDB_API_KEY) {
      // append api_key to URL
      url += `&api_key=${encodeURIComponent(TMDB_API_KEY)}`;
    } else {
      // no creds set
      return json(req, 500, { error: "TMDB credentials not configured" });
    }

    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return json(req, resp.status, { error: "TMDB error", details: text });
    }

    const data = await resp.json();
    const items = Array.isArray(data?.results) ? data.results : [];

    const results = items.slice(0, 18).map((m: any) => ({
      id: m.id,
      title: m.title ?? m.name ?? "",
      posterUrl: m.poster_path ? `${IMG_BASE}/${POSTER_SIZE}${m.poster_path}` : null,
      backdropUrl: m.backdrop_path ? `${IMG_BASE}/${BACKDROP_SIZE}${m.backdrop_path}` : null,
      year: (m.release_date || "").slice(0, 4) || null,
      media_type: "movie",
    }));

    return json(req, 200, { results });
  } catch (e) {
    console.error("[search-stills] error:", e);
    return json(req, 500, { error: "Internal error" });
  }
});

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(req),
    },
  });
}
