// supabase/functions/search-stills/index.ts
import { serve } from "https://deno.land/std/http/server.ts";

const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*", // or "http://localhost:3000" if you prefer strict
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  // 1) CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2) Parse payload
    const contentType = req.headers.get("content-type") || "";
    let q = "";

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({}));
      q = (body?.q || body?.query || "").toString().trim();
    } else {
      // support GET ?q=...
      const url = new URL(req.url);
      q = (url.searchParams.get("q") || "").toString().trim();
    }

    if (!q) {
      return new Response(JSON.stringify({ results: [] }), {
        status: 200, // never 204
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Call TMDB (use your env var)
    const TMDB_KEY = Deno.env.get("TMDB_API_KEY") ?? Deno.env.get("VITE_TMDB_V3_API_KEY") ?? "";
    if (!TMDB_KEY) {
      return new Response(JSON.stringify({ error: "TMDB_API_KEY missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&include_adult=false`,
    );
    if (!tmdbRes.ok) {
      const txt = await tmdbRes.text();
      return new Response(JSON.stringify({ error: "TMDB upstream error", detail: txt }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await tmdbRes.json();
    const results = Array.isArray(json?.results) ? json.results : [];

    // 4) Normalize to { id, title, backdropUrl, posterUrl }
    const normalized = results.map((r) => ({
      id: r.id,
      title: r.title ?? r.name ?? "",
      backdropUrl: r.backdrop_path ? `https://image.tmdb.org/t/p/w1280${r.backdrop_path}` : null,
      posterUrl: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
    }));

    return new Response(JSON.stringify({ results: normalized }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    // 5) Always return JSON + CORS, never 204
    return new Response(JSON.stringify({ error: "Unhandled error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
