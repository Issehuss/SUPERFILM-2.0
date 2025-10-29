// supabase/functions/tmdb-rich-images/index.ts
// Deno/TypeScript (Supabase Edge Functions)
import "https://deno.land/x/dotenv/load.ts";

const TMDB_V3 = Deno.env.get("TMDB_V3_API_KEY")!;
const TMDB_V4 = Deno.env.get("TMDB_V4_READ_TOKEN")!;

type Img = {
  path: string;          // file_path
  width: number;
  height: number;
  vote_average?: number;
  vote_count?: number;
  source: "movie" | "tv" | "collection" | "episode";
  tmdb_id: number;
  aspect?: number;
};

function authBearer(req: Request) {
  // You likely already have a Supabase JWT coming from the client.
  // Extract if you need to query user entitlements server-side.
  // Or pass "x-premium: 1" only after verifying on the server earlier.
  const premium = req.headers.get("x-premium") === "1"; // simple gate
  return { premium };
}

const TMDB = {
  async searchMulti(q: string, page = 1) {
    const r = await fetch(`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(q)}&page=${page}&include_adult=false`, {
      headers: { Authorization: `Bearer ${TMDB_V4}` },
    });
    if (!r.ok) throw new Error(`tmdb search failed: ${r.status}`);
    return r.json();
  },
  async movieImages(id: number) {
    const r = await fetch(`https://api.themoviedb.org/3/movie/${id}/images?include_image_language=null,en,*`, {
      headers: { Authorization: `Bearer ${TMDB_V4}` },
    });
    if (!r.ok) return null;
    return r.json();
  },
  async tvImages(id: number) {
    const r = await fetch(`https://api.themoviedb.org/3/tv/${id}/images?include_image_language=null,en,*`, {
      headers: { Authorization: `Bearer ${TMDB_V4}` },
    });
    if (!r.ok) return null;
    return r.json();
  },
  async tvSeasonEpisodesImages(tvId: number, season: number) {
    // Pull episode stills for the season (bigger pool of “stills”)
    const r = await fetch(`https://api.themoviedb.org/3/tv/${tvId}/season/${season}?append_to_response=images&include_image_language=null,en,*`, {
      headers: { Authorization: `Bearer ${TMDB_V4}` },
    });
    if (!r.ok) return null;
    return r.json();
  },
  async collectionImages(id: number) {
    const r = await fetch(`https://api.themoviedb.org/3/collection/${id}/images?include_image_language=null,en,*`, {
      headers: { Authorization: `Bearer ${TMDB_V4}` },
    });
    if (!r.ok) return null;
    return r.json();
  },
};

function toImgsFromMovie(id: number, images: any): Img[] {
  const arr: Img[] = [];
  for (const b of images?.backdrops || []) {
    arr.push({
      path: b.file_path, width: b.width, height: b.height,
      vote_average: b.vote_average, vote_count: b.vote_count,
      source: "movie", tmdb_id: id, aspect: b.width && b.height ? b.width / b.height : undefined,
    });
  }
  return arr;
}

function toImgsFromTv(id: number, images: any): Img[] {
  const arr: Img[] = [];
  for (const b of images?.backdrops || []) {
    arr.push({
      path: b.file_path, width: b.width, height: b.height,
      vote_average: b.vote_average, vote_count: b.vote_count,
      source: "tv", tmdb_id: id, aspect: b.width && b.height ? b.width / b.height : undefined,
    });
  }
  return arr;
}

function toImgsFromCollection(id: number, images: any): Img[] {
  const arr: Img[] = [];
  for (const b of images?.backdrops || []) {
    arr.push({
      path: b.file_path, width: b.width, height: b.height,
      vote_average: b.vote_average, vote_count: b.vote_count,
      source: "collection", tmdb_id: id, aspect: b.width && b.height ? b.width / b.height : undefined,
    });
  }
  return arr;
}

function toImgsFromSeasonEpisodes(tvId: number, season: any): Img[] {
  const arr: Img[] = [];
  for (const ep of season?.episodes || []) {
    for (const s of ep?.images?.stills || []) {
      arr.push({
        path: s.file_path, width: s.width, height: s.height,
        vote_average: s.vote_average, vote_count: s.vote_count,
        source: "episode", tmdb_id: tvId, aspect: s.width && s.height ? s.width / s.height : undefined,
      });
    }
  }
  return arr;
}

function filterAndSort(imgs: Img[], { wantLandscape = true }) {
  // Prefer banner-friendly: aspect >= 1.6 (roughly 16:10+) and decent size
  const MIN_W = 1000;
  const MIN_AR = wantLandscape ? 1.6 : 1.33;

  const cleaned = imgs
    .filter(i => i.path && i.width >= MIN_W && (i.aspect ?? 0) >= MIN_AR)
    .sort((a, b) => {
      // rank by vote_count, then vote_average, then width
      const vc = (b.vote_count || 0) - (a.vote_count || 0);
      if (vc) return vc;
      const va = (b.vote_average || 0) - (a.vote_average || 0);
      if (va) return va;
      return (b.width || 0) - (a.width || 0);
    });

  // de-dup by file path
  const seen = new Set<string>();
  const dedup: Img[] = [];
  for (const i of cleaned) {
    if (seen.has(i.path)) continue;
    seen.add(i.path);
    dedup.push(i);
  }
  return dedup;
}

Deno.serve(async (req: Request) => {
  try {
    const { premium } = authBearer(req);

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    if (!q) return new Response(JSON.stringify({ results: [] }), { headers: { "content-type": "application/json" }});

    // how many pages & max images varies by plan
    const pages = premium ? 3 : 1;
    const maxOut = premium ? 120 : 24;

    let results: Img[] = [];

    // 1) Multi search (movies & TV). We’ll pull images for top matches.
    for (let p = 1; p <= pages; p++) {
      const multi = await TMDB.searchMulti(q, p);
      const top = (multi?.results || []).slice(0, premium ? 12 : 6);

      for (const item of top) {
        if (item.media_type === "movie") {
          const imgs = await TMDB.movieImages(item.id);
          if (imgs) results.push(...toImgsFromMovie(item.id, imgs));
          if (item.belongs_to_collection?.id) {
            const col = await TMDB.collectionImages(item.belongs_to_collection.id);
            if (col) results.push(...toImgsFromCollection(item.belongs_to_collection.id, col));
          }
        } else if (item.media_type === "tv") {
          const imgs = await TMDB.tvImages(item.id);
          if (imgs) results.push(...toImgsFromTv(item.id, imgs));

          // For premium: pull episode stills for first 2 seasons for more “stills”
          if (premium && item.first_air_date) {
            for (let s = 1; s <= 2; s++) {
              const season = await TMDB.tvSeasonEpisodesImages(item.id, s);
              if (season) results.push(...toImgsFromSeasonEpisodes(item.id, season));
            }
          }
        }
      }
    }

    const ordered = filterAndSort(results, { wantLandscape: true }).slice(0, maxOut);

    // Return raw TMDB paths; client should render using base URL & size.
    return new Response(JSON.stringify({ results: ordered }), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=86400" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "tmdb error" }), { status: 500 });
  }
});
