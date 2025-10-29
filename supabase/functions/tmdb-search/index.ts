// Deno / Supabase Edge Function
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // Body must be JSON: { q: string }
    const body = await req.json().catch(() => ({}));
    const q = (body?.q ?? "").toString().trim();
    if (!q) {
      return new Response(JSON.stringify({ error: "Missing q" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const token = Deno.env.get("TMDB_READ_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing TMDB_READ_TOKEN" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const qs = new URLSearchParams({
      query: q,
      include_adult: "false",
      language: "en-US",
      page: "1",
    });

    const url = `https://api.themoviedb.org/3/search/movie?${qs.toString()}`;

    const tmdbResp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`, // TMDB v4 read token
        "Content-Type": "application/json;charset=utf-8",
      },
    });

    const text = await tmdbResp.text();
    return new Response(text, {
      status: tmdbResp.status,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
