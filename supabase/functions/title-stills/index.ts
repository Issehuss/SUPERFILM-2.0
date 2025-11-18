// supabase/functions/title-stills/index.ts
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
  const origin = req.headers.get("origin") ?? "";
  if (!/^https?:\/\/(localhost:3000|.*yourdomain\.com)$/i.test(origin)) {
    return new Response("Origin not allowed", { status: 403 });
  }

  const supabaseClient = (await import("jsr:@supabase/supabase-js@2")).createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } }
  );
  const { data: userRes } = await supabaseClient.auth.getUser();
  const user = userRes?.user || null;

  const isPremium =
    (user?.app_metadata?.plan === "directors_cut") ||
    (user?.user_metadata?.is_premium === true);

  // Gate: Only premium can fetch the large gallery
  if (!isPremium) {
    return new Response(JSON.stringify({ error: "Premium required" }), {
      status: 402,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { id, kind } = await req.json().catch(() => ({ id: null, kind: "movie" }));
  if (!id || !kind) {
    return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
  }

  // movie|tv|collection
  // /images endpoints: movie/tv have images; collections use /collection/{id} which nests parts
  let images: any[] = [];

  if (kind === "collection") {
    const r = await tmdb(`https://api.themoviedb.org/3/collection/${id}`);
    const j = await r.json().catch(() => null);
    const parts = j?.parts || [];
    // pull images for each movie in the collection
    for (const p of parts.slice(0, 12)) {
      const r2 = await tmdb(`https://api.themoviedb.org/3/movie/${p.id}/images`);
      const j2 = await r2.json().catch(() => null);
      const stills = [
        ...(j2?.backdrops || []),
        ...(j2?.posters || []),
        ...(j2?.logos || []),
      ];
      images.push(...stills.map((s: any) => ({
        url: `https://image.tmdb.org/t/p/w1280${s.file_path}`,
        w: s.width,
        h: s.height,
        aspect: s.aspect_ratio,
        type: "movie-part",
        parent: p.id,
      })));
    }
  } else {
    const r = await tmdb(`https://api.themoviedb.org/3/${kind}/${id}/images`);
    const j = await r.json().catch(() => null);
    images = [
      ...(j?.backdrops || []),
      ...(j?.stills || []), // exists for episodes; harmless otherwise
      ...(j?.posters || []),
      ...(j?.logos || []),
    ].map((s: any) => ({
      url: `https://image.tmdb.org/t/p/w1280${s.file_path}`,
      w: s.width,
      h: s.height,
      aspect: s.aspect_ratio,
      type: "asset",
    }));
  }

  // Limit generously for premium
  const LIMIT = 48;
  return new Response(JSON.stringify(images.slice(0, LIMIT)), {
    headers: { "Content-Type": "application/json" },
  });
});
