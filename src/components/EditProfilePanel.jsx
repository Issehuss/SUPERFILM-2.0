// src/components/EditProfilePanel.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import ProfileQuickEditor from "./ProfileQuickEditor";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";
import { questionList } from "../constants/tasteQuestions";
import AvatarCropper from "./AvatarCropper"; // reused as a general cropper (pass aspect)
import { glowOptions } from "../constants/glowOptions";
import { env } from "../lib/env";

/* Utility: resolve TMDB key from multiple places */
const TMDB_KEY =
  env?.TMDB_API_KEY ||
  process.env.REACT_APP_TMDB_KEY ||
  process.env.REACT_APP_TMDB_API_KEY ||
  (typeof import.meta !== "undefined" ? import.meta.env?.VITE_TMDB_KEY : undefined) ||
  (typeof import.meta !== "undefined" ? import.meta.env?.VITE_TMDB_API_KEY : undefined);

/* ---------- Compact Favourite Films search (TMDB) ---------- */
function CompactFilmSearch({ onPick }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  async function search(term) {
    const query = (term || "").trim();
    if (!query) return setResults([]);
    if (!TMDB_KEY) return setResults([]);
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(
          query
        )}&include_adult=false`
      );
      const data = await res.json();
      setResults(Array.isArray(data?.results) ? data.results.slice(0, 12) : []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => search(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search films…"
          className="flex-1 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:border-yellow-400"
        />
        <button
          onClick={() => search(q)}
          className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-sm border border-neutral-700"
        >
          Search
        </button>
      </div>

      {loading && <div className="text-xs text-neutral-400">Searching…</div>}

      {!loading && results.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {results.map((m) => {
            const poster = m.poster_path
              ? `https://image.tmdb.org/t/p/w185${m.poster_path}`
              : "/posters/placeholder.jpg";
            return (
              <button
                key={m.id}
                onClick={() =>
                  onPick({ id: m.id, title: m.title, poster_path: m.poster_path || "" })
                }
                className="group text-left"
                title={m.title}
              >
                <div className="aspect-[2/3] overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
                  <img
                    src={poster}
                    alt={m.title}
                    className="w-full h-full object-cover group-hover:opacity-90"
                    loading="lazy"
                  />
                </div>
                <div className="mt-1 text-[11px] text-neutral-300 line-clamp-2 leading-tight">
                  {m.title}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!loading && TMDB_KEY && q && results.length === 0 && (
        <div className="text-xs text-neutral-500">No results.</div>
      )}

      {!TMDB_KEY && (
        <div className="text-[11px] text-neutral-500">
          Set <code>REACT_APP_TMDB_KEY</code> (CRA) or{" "}
          <code>VITE_TMDB_API_KEY</code> (Vite) in <code>.env.local</code> to
          enable search.
        </div>
      )}
    </div>
  );
}

/* ---------- Compact Taste Editor (2 columns) ---------- */
function CompactTasteEditor({ value, onChange, max = 4 }) {
  // value: [{ question, answer }]
  const selected = useMemo(
    () => new Map(value?.map((v) => [v.question, v]) || []),
    [value]
  );

  function toggleQuestion(q) {
    const next = new Map(selected);
    if (next.has(q)) next.delete(q);
    else {
      if (next.size >= max) return;
      next.set(q, { question: q, answer: "" });
    }
    onChange(Array.from(next.values()));
  }

  function updateAnswer(q, ans) {
    const next = new Map(selected);
    if (!next.has(q)) return;
    next.set(q, { ...next.get(q), answer: ans });
    onChange(Array.from(next.values()));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold">Taste Cards</h3>
        <div className="text-xs text-neutral-400">
          {selected.size}/{max} selected
        </div>
      </div>

      {/* 2 columns */}
      <div className="grid grid-cols-2 gap-3">
        {questionList.map((q) => {
          const isOn = selected.has(q);
          return (
            <div
              key={q}
              className={`rounded-xl border p-3 ${
                isOn
                  ? "border-yellow-500/60 bg-yellow-500/5"
                  : "border-neutral-800 bg-neutral-900"
              }`}
            >
              <label className="flex items-start gap-2 text-sm text-neutral-200">
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggleQuestion(q)}
                  className="mt-0.5"
                />
                <span className="leading-tight">{q}</span>
              </label>

              {isOn && (
                <textarea
                  rows={2}
                  value={selected.get(q)?.answer || ""}
                  onChange={(e) => updateAnswer(q, e.target.value)}
                  placeholder="Your answer…"
                  className="mt-2 w-full rounded-lg bg-neutral-950 border border-neutral-800 px-2 py-1.5 text-sm text-white placeholder-neutral-500 outline-none focus:border-yellow-400"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Glow Preset Carousel ---------- */
function GlowPresetCarousel({ value, onChange }) {
  const presets = glowOptions.free || [];
  return (
    <div className="space-y-2">
      <div className="text-xs text-neutral-400">Glow preset</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {presets.map((opt) => (
          <button
            key={opt.class}
            onClick={() => onChange(opt.class)}
            className={`shrink-0 px-3 py-2 rounded-xl border ${
              value === opt.class
                ? "border-yellow-500/60 bg-yellow-500/10"
                : "border-neutral-800 bg-neutral-900"
            }`}
            title={opt.name || opt.class}
          >
            <div className="text-[11px] text-neutral-200">
              {opt.name || opt.class}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Compact Banner Search (TMDB backdrops, no local upload) + Cropping ---------- */
function CompactBannerSearch({ current, onPickDirect, onCropFromUrl }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  async function search(term) {
    const query = (term || "").trim();
    if (!query) return setResults([]);
    if (!TMDB_KEY) return setResults([]);
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(
          query
        )}&include_adult=false`
      );
      const data = await res.json();
      const withBackdrops = (data?.results || []).filter((r) => r.backdrop_path);
      setResults(withBackdrops.slice(0, 8));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => search(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-3">
      {/* Current preview */}
      {current ? (
        <div className="rounded-xl overflow-hidden border border-neutral-800">
          <img src={current} alt="Current banner" className="w-full h-28 object-cover" />
        </div>
      ) : (
        <div className="text-xs text-neutral-400">No banner set.</div>
      )}

      {/* Search TMDB (no local upload; film stills only) */}
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search movie backdrops…"
          className="flex-1 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 outline-none focus:border-yellow-400"
        />
        <button
          onClick={() => search(q)}
          className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-sm border border-neutral-700"
        >
          Search
        </button>
      </div>

      {loading && <div className="text-xs text-neutral-400">Searching…</div>}

      {!loading && results.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {results.map((m) => {
            const w780 = `https://image.tmdb.org/t/p/w780${m.backdrop_path}`;
            const w1280 = `https://image.tmdb.org/t/p/w1280${m.backdrop_path}`;
            return (
              <div
                key={`${m.id}-${m.backdrop_path}`}
                className="group rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900"
              >
                <img
                  src={w780}
                  alt={m.title}
                  className="w-full h-24 object-cover group-hover:opacity-90"
                  loading="lazy"
                />
                <div className="px-2 py-1 text-[11px] text-neutral-300 truncate">
                  {m.title}
                </div>
                <div className="flex gap-2 p-2">
                  <button
                    onClick={() => onPickDirect(w1280)} // set directly (no crop)
                    className="flex-1 text-[11px] px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700"
                  >
                    Use
                  </button>
                  <button
                    onClick={() => onCropFromUrl(w1280)} // crop this TMDB image to 16:9
                    className="flex-1 text-[11px] px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700"
                  >
                    Crop
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && TMDB_KEY && q && results.length === 0 && (
        <div className="text-xs text-neutral-500">No results.</div>
      )}

      {!TMDB_KEY && (
        <div className="text-[11px] text-neutral-500">
          Set <code>REACT_APP_TMDB_KEY</code> (CRA) or{" "}
          <code>VITE_TMDB_API_KEY</code> (Vite) in <code>.env.local</code> to
          enable search.
        </div>
      )}
    </div>
  );
}

/* ---------- Panel ---------- */
export default function EditProfilePanel({ open, onClose, onUpdated }) {
  const panelRef = useRef(null);
  const { user } = useUser();

  // Tabs
  const [tab, setTab] = useState("basics");

  // Taste & favourites
  const [tasteCards, setTasteCards] = useState([]);
  const [favoriteFilms, setFavoriteFilms] = useState([]);
  const [useGlowStyle, setUseGlowStyle] = useState(true);
  const [glowPreset, setGlowPreset] = useState(null);

  const [savingTaste, setSavingTaste] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  // Banner (panel-local preview)
  const [bannerImage, setBannerImage] = useState("");

  // Banner cropper
  const [cropSrc, setCropSrc] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Focus panel on open
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  // Load taste/favourites + banner when panel opens
  useEffect(() => {
    if (!open || !user?.id) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "taste_cards, favorite_films, use_glow_style, glow_preset, banner_url, banner_image, banner_gradient"
        )
        .eq("id", user.id)
        .maybeSingle();

      setTasteCards(Array.isArray(data?.taste_cards) ? data.taste_cards : []);
      setFavoriteFilms(
        Array.isArray(data?.favorite_films) ? data.favorite_films : []
      );
      setUseGlowStyle(
        typeof data?.use_glow_style === "boolean" ? data.use_glow_style : true
      );
      setGlowPreset(data?.glow_preset ?? null);

      // Prefer banner_url, fallback to legacy banner_image
      setBannerImage(data?.banner_url || data?.banner_image || "");
    })();
  }, [open, user?.id]);

  // Helpers
  function normalizedTasteCards(cards) {
    const out = [];
    const seen = new Set();
    for (const c of cards || []) {
      if (!c?.question) continue;
      if (seen.has(c.question)) continue;
      const ans = (c.answer || "").trim();
      if (!ans) continue;
      seen.add(c.question);
      out.push({ question: c.question, answer: ans });
      if (out.length >= 4) break;
    }
    return out;
  }

  function handleAddFavourite(m) {
    setFavoriteFilms((prev) => {
      if (prev.some((f) => f.id === m.id)) return prev;
      const next = [
        ...prev,
        { id: m.id, title: m.title, poster_path: m.poster_path || "" },
      ];
      return next.slice(0, 12);
    });
  }
  function handleRemoveFavourite(id) {
    setFavoriteFilms((prev) => prev.filter((f) => f.id !== id));
  }

  async function saveTasteAndFavourites() {
    if (!user?.id) return;
    setSavingTaste(true);
    setError("");
    setOk("");
    try {
      const finalized = normalizedTasteCards(tasteCards);

      const { error: err } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            taste_cards: finalized,
            favorite_films: favoriteFilms, // ensure this column exists (jsonb)
            use_glow_style: useGlowStyle,
            glow_preset: glowPreset ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (err) throw err;

      setOk("Saved.");
      onUpdated?.({
        taste_cards: finalized,
        favorite_films: favoriteFilms,
        use_glow_style: useGlowStyle,
        glow_preset: glowPreset ?? null,
      });
    } catch (e) {
      setError(e?.message || "Failed to save.");
    } finally {
      setSavingTaste(false);
    }
  }

  // -------- Banner save helpers --------
  async function persistBanner(url) {
    if (!user?.id || !url) return;
    try {
      setBannerImage(url);

      // Write canonical banner_url, plus legacy banner_image for compatibility
      const patch = {
        id: user.id,
        banner_url: url,
        banner_image: url,
        updated_at: new Date().toISOString(),
      };

      const { error: err } = await supabase
        .from("profiles")
        .upsert(patch, { onConflict: "id" });

      if (err) throw err;

      // Mirror locally so view mode updates instantly
      try {
        localStorage.setItem("userBanner", url);
      } catch {}

      // Notify parent in both shapes
      onUpdated?.({ banner_url: url, banner_image: url });
    } catch (e) {
      setError(e?.message || "Failed to set banner.");
    }
  }

  async function openCropperWithUrl(url) {
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const fr = new FileReader();
      fr.onloadend = () => {
        setCropSrc(fr.result);
        setShowCropper(true);
      };
      fr.readAsDataURL(blob);
    } catch {
      setError("Could not load image for cropping.");
    }
  }

  function dataURLtoBlob(dataUrl) {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8 = new Uint8Array(n);
    while (n--) u8[n] = bstr.charCodeAt(n);
    return new Blob([u8], { type: mime });
  }

  async function handleBannerCropComplete(croppedDataUrl) {
    if (!user?.id || !croppedDataUrl) {
      setShowCropper(false);
      return;
    }
    // Upload cropped banner to Storage (public bucket: "banners")
    try {
      const blob = dataURLtoBlob(croppedDataUrl);
      const file = new File([blob], `banner-${Date.now()}.jpg`, {
        type: blob.type || "image/jpeg",
      });

      const path = `${user.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("banners")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      const publicUrl =
        supabase.storage.from("banners").getPublicUrl(path).data.publicUrl;

      await persistBanner(publicUrl);
    } catch (e) {
      setError(e?.message || "Failed to save banner.");
    } finally {
      setShowCropper(false);
      setCropSrc(null);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        ref={panelRef}
        tabIndex={-1}
        className={`fixed right-0 top-0 h-full w-full sm:w-[560px] max-w-[92vw] bg-neutral-950 border-l border-neutral-800 shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Edit Profile"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-neutral-800">
          <h2 className="text-white font-semibold text-lg">Edit Profile</h2>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-100 text-sm border border-neutral-700"
            aria-label="Done editing profile"
          >
            Done
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 sm:px-6 pt-3">
          <div className="inline-flex rounded-xl border border-neutral-800 p-1 bg-neutral-900">
            <button
              className={`px-3 py-1.5 rounded-lg text-sm ${
                tab === "basics"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-300 hover:text-white"
              }`}
              onClick={() => setTab("basics")}
            >
              Basics
            </button>
            <button
              className={`ml-1 px-3 py-1.5 rounded-lg text-sm ${
                tab === "taste"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-300 hover:text-white"
              }`}
              onClick={() => setTab("taste")}
            >
              Taste & Favourites
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto h-[calc(100%-116px)]">
          {tab === "basics" && (
            <div className="space-y-8">
              {/* Basics (avatar, display name, bio, club tag, username) */}
              <ProfileQuickEditor onUpdated={onUpdated} />

              {/* Banner section (TMDB search + crop; no local uploads) */}
              <section className="space-y-3">
                <h3 className="text-white font-semibold">Banner</h3>
                <CompactBannerSearch
                  current={bannerImage}
                  onPickDirect={persistBanner}     // set TMDB backdrop directly (no crop)
                  onCropFromUrl={openCropperWithUrl} // crop selected TMDB result to 16:9
                />
                <p className="text-[11px] text-neutral-500">
                  Choose a film still via TMDB. Use “Crop” to frame it before saving.
                </p>
              </section>
            </div>
          )}

          {tab === "taste" && (
            <div className="space-y-8">
              {/* Favourite films (compact) */}
              <section className="space-y-3">
                <h3 className="text-white font-semibold">Favourite Films</h3>
                <CompactFilmSearch onPick={handleAddFavourite} />
                {favoriteFilms.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {favoriteFilms.map((f) => {
                      const poster = f.poster_path
                        ? `https://image.tmdb.org/t/p/w185${f.poster_path}`
                        : "/posters/placeholder.jpg";
                      return (
                        <div key={f.id} className="relative">
                          <div className="aspect-[2/3] overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
                            <img
                              src={poster}
                              alt={f.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          <div className="mt-1 text-[11px] text-neutral-300 line-clamp-2 leading-tight">
                            {f.title}
                          </div>
                          <button
                            onClick={() => handleRemoveFavourite(f.id)}
                            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-neutral-900 border border-neutral-700 text-[11px] text-neutral-200 hover:bg-neutral-800"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Glow preset + Taste editor */}
              <section className="space-y-4">
                <GlowPresetCarousel value={glowPreset} onChange={setGlowPreset} />
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-semibold">Taste Cards</h3>
                  <label className="flex items-center gap-2 text-xs text-neutral-300">
                    <input
                      type="checkbox"
                      checked={useGlowStyle}
                      onChange={(e) => setUseGlowStyle(e.target.checked)}
                    />
                    Use Glow Style
                  </label>
                </div>
                <CompactTasteEditor value={tasteCards} onChange={setTasteCards} max={4} />
              </section>

              {/* Sticky save bar */}
              <div className="sticky bottom-0 bg-neutral-950 pt-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={saveTasteAndFavourites}
                    disabled={savingTaste}
                    className="rounded-xl bg-yellow-400 text-black font-semibold px-4 py-2 disabled:opacity-60"
                  >
                    {savingTaste ? "Saving…" : "Save changes"}
                  </button>
                  {ok && <span className="text-green-400 text-sm">{ok}</span>}
                  {error && <span className="text-red-400 text-sm">{error}</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Reuse AvatarCropper as banner cropper (force 16:9 if your cropper supports it). */}
      {showCropper && cropSrc && (
        <AvatarCropper
          imageSrc={cropSrc}
          aspect={16 / 9} // AvatarCropper should forward this to react-easy-crop
          onCropComplete={handleBannerCropComplete}
          onCancel={() => {
            setShowCropper(false);
            setCropSrc(null);
          }}
        />
      )}
    </>
  );
}
