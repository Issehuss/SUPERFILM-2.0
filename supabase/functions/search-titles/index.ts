// Deno Deploy / Supabase Edge Function
// supabase/functions/search-titles/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const TMDB_BEARER = Deno.env.get("TMDB_BEARER") || "";

function tmdb(url: string) {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${TMDB_BEARER}`,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  // Optional: allow only your site(s)
  const origin = req.headers.get("origin") ?? "";
  if (!/^https?:\/\/(localhost:3000|.*yourdomain\.com)$/i.test(origin)) {
    return new Response("Origin not allowed", { status: 403 });
  }

  // Auth (to know plan)
  const supabaseClient = (await import("jsr:@supabase/supabase-js@2")).createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
  );
  const { data: userRes } = await supabaseClient.auth.getUser();
  const user = userRes?.user || null;

  // Gate (premium only – you can loosen this if you want titles available for free)
  const isPremium =
    (user?.app_metadata?.plan === "directors_cut") ||
    (user?.user_metadata?.is_premium === true);

  // If you want this endpoint usable by free too, delete this check:
  if (!isPremium) {
    return new Response(JSON.stringify({ error: "Premium required" }), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { query } = await req.json().catch(() => ({ query: "" }));
  const q = (query || "").trim();
  if (!q) {
    return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
  }

  const urls = [
    `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(q)}&include_adult=false`,
    `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(q)}&include_adult=false`,
    `https://api.themoviedb.org/3/search/collection?query=${encodeURIComponent(q)}`,
  ];

  const all: any[] = [];
  for (const url of urls) {
    const r = await tmdb(url);
    const j = await r.json().catch(() => null);
    if (j?.results?.length) {
      for (const res of j.results) {
        const isTV = typeof res.first_air_date === "string" || "name" in res && !("title" in res);
        const kind = url.includes("/search/tv")
          ? "tv"
          : url.includes("/search/collection")
          ? "collection"
          : "movie";

        all.push({
          id: res.id,
          kind,
          title: res.title || res.name || "",
          year:
            res.release_date?.slice(0, 4) ||
            res.first_air_date?.slice(0, 4) ||
            null,
          poster: res.poster_path ? `https://image.tmdb.org/t/p/w342${res.poster_path}` : null,
          backdrop: res.backdrop_path ? `https://image.tmdb.org/t/p/w780${res.backdrop_path}` : null,
        });
      }
    }
  }

  // Deduplicate by (id + kind) and trim
  const seen = new Set<string>();
  const deduped = all.filter((x) => {
    const k = `${x.kind}:${x.id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return new Response(JSON.stringify(deduped.slice(0, 30)), {
    headers: { "Content-Type": "application/json" },
  });
});
