// src/components/Moodboard.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import supabase from "../supabaseClient";
import { X, Plus, ArrowUpRight, Search, Upload, Trash2, Type, Palette } from "lucide-react";
import { searchMovies } from "../lib/tmdbClient"; // ✅ shared TMDB helper
import { toast } from "react-hot-toast";
import useEntitlements from "../hooks/useEntitlements";
import { trackEvent } from "../lib/analytics";

/**
 * Moodboard item types:
 *  - { type: "image", url, source?: "tmdb"|"upload"|"url", title?: string, size?: "s"|"m"|"w"|"t" }
 *  - { type: "quote", text, attribution?: string, size?: ... }
 *  - { type: "color", hex, size?: ... }
 *  - { type: "keyword", text, size?: ... }
 */

export default function Moodboard({
  profileId,
  isOwner = false,
  className = "",
  maxPreview = 6,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState(null);
  const [error, setError] = useState("");

  // Entitlements (limits with safe fallback)
  const { limits: rawLimits } = useEntitlements();
  const limits = {
    moodboardTiles: rawLimits?.moodboardTiles ?? 6, // default 6 for free
  };
  const isPremium = rawLimits?.isPremium === true;
  const limitHitOnceRef = useRef(false);

  // allow external triggers (from EditProfilePanel) to force a reload
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    function onUpdated(e) {
      if (!profileId || e?.detail?.profileId === profileId) {
        setRefreshTick((t) => t + 1);
      }
    }
    window.addEventListener("sf:moodboard:updated", onUpdated);
    return () => window.removeEventListener("sf:moodboard:updated", onUpdated);
  }, [profileId]);

  // Collage sizes → CSS spans
  const SIZE_CLASSES = {
    s: "col-span-2 row-span-2",
    m: "col-span-3 row-span-2",
    w: "col-span-4 row-span-2",
    t: "col-span-2 row-span-3",
  };
  const SIZE_ORDER = ["m", "s", "w", "t"];
  const OVERLAP = 2; // tiny overlap between tiles

  // Load from DB (profiles.moodboard jsonb) or fallback to localStorage
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (!profileId) {
          const ls = localStorage.getItem("sf_moodboard_preview");
          if (!cancelled) setItems(ls ? JSON.parse(ls) : []);
          setLoading(false);
          return;
        }
        const { data, error: dbErr } = await supabase
          .from("profiles")
          .select("moodboard")
          .eq("id", profileId)
          .maybeSingle();

        if (dbErr) {
          const ls = localStorage.getItem("sf_moodboard_preview");
          if (!cancelled) {
            setItems(ls ? JSON.parse(ls) : []);
            setLoading(false);
          }
          return;
        }

        const arr = Array.isArray(data?.moodboard) ? data.moodboard : [];
        if (!cancelled) {
          setItems(arr);
          setLoading(false);
        }
      } catch {
        const ls = localStorage.getItem("sf_moodboard_preview");
        if (!cancelled) {
          setItems(ls ? JSON.parse(ls) : []);
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [profileId, refreshTick]);

  // Persist to DB (if available) + localStorage as backup
  async function persist(next) {
    setItems(next);
    try {
      localStorage.setItem("sf_moodboard_preview", JSON.stringify(next));
      if (!profileId) return;
      await supabase.from("profiles").update({ moodboard: next }).eq("id", profileId);
    } catch {
      // non-fatal
    }
  }

  function removeAt(idx) {
    const next = items.filter((_, i) => i !== idx);
    persist(next);
  }

  function resizeAt(idx) {
    const next = items.map((it, i) => {
      if (i !== idx) return it;
      const curr = it.size && SIZE_CLASSES[it.size] ? it.size : "m";
      const nextSize = SIZE_ORDER[(SIZE_ORDER.indexOf(curr) + 1) % SIZE_ORDER.length];
      return { ...it, size: nextSize };
    });
    persist(next);
  }

  function openAddDialog({ replaceAt = null } = {}) {
    setReplaceIndex(replaceAt);
    setAdding(true);
  }

  function closeAddDialog() {
    setAdding(false);
    setReplaceIndex(null);
  }

  // Premium gating: free users capped at N tiles
  function handleAddTileRequest() {
    // Block only when adding a brand-new tile (not replacing)
    if (replaceIndex == null && items.length >= limits.moodboardTiles) {
      const limitCount = limits.moodboardTiles;
      const premiumLimit = 120;
      if (!limitHitOnceRef.current) {
        trackEvent("limit_hit", {
          feature: "moodboard",
          plan: rawLimits?.plan || (isPremium ? "directors_cut" : "free"),
        });
        limitHitOnceRef.current = true;
      }
      const copy = isPremium
        ? `Moodboard limit reached (${limitCount} stills).`
        : `You’ve reached the free Moodboard limit (${limitCount} stills). Director’s Cut unlocks up to ${premiumLimit} stills — try it free for 14 days.`;
      const showUpsell = !isPremium;

      toast((t) => (
        <div className="text-sm text-left space-y-3 text-white">
          <div className="font-semibold">{copy}</div>
          {showUpsell ? (
            <button
              type="button"
              onClick={() => {
                window.location.href = "/premium";
                toast.dismiss(t.id);
                trackEvent("trial_started", { source: "moodboard_limit" });
              }}
              className="inline-flex items-center justify-center rounded-full px-4 py-2 font-semibold text-black bg-white hover:bg-white/90 text-sm transition shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
            >
              Start 14-day free trial
            </button>
          ) : null}
        </div>
      ), {
        duration: 7000,
        style: {
          background: "rgba(10,10,10,0.92)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
        },
      });
      return;
    }
    openAddDialog({ replaceAt: null });
  }

  function addItem(newItem) {
    const normalized = normalizeItem(newItem);
    const idx = replaceIndex != null ? replaceIndex : items.length;
    const seed = ["w", "t", "m", "s", "m", "s"];
    const seeded = { ...normalized, size: normalized.size || seed[idx % seed.length] || "m" };

    // Safety: enforce limit in case something bypassed the button guard
    if (replaceIndex == null && items.length >= limits.moodboardTiles) {
      const limitCopy = isPremium
        ? "Moodboard limit reached."
        : `You’ve reached the free Moodboard limit (${limits.moodboardTiles} stills). Director’s Cut unlocks up to 120 stills — try it free for 14 days.`;
      toast(limitCopy, {
        duration: 6000,
        style: {
          background: "rgba(10,10,10,0.92)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
        },
      });
      return;
    }

    const next = [...items];
    if (replaceIndex != null) next[replaceIndex] = seeded;
    else next.push(seeded);

    persist(next);
    closeAddDialog();
  }

  const preview = useMemo(() => items.slice(0, maxPreview), [items, maxPreview]);

  if (loading) {
    return (
      <div className={`rounded-2xl border border-zinc-800 bg-black/40 p-4 ${className}`}>
        <div className="h-40 animate-pulse rounded-xl bg-zinc-900" />
      </div>
    );
  }

  return (
    <div
      className={
        isOwner && typeof window !== "undefined" && window?.document?.body?.dataset?.theme === "premium"
          ? `themed-card themed-outline forge rounded-2xl p-4 ${className}`
          : `rounded-2xl border border-zinc-800 bg-black/40 p-4 ${className}`
      }
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Moodboard</h3>
        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              type="button"
              onClick={handleAddTileRequest}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-white hover:bg-zinc-900"
              title="Add item"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-white hover:bg-zinc-900"
            title="Expand"
          >
            <ArrowUpRight className="h-4 w-4" />
            Expand
          </button>
        </div>
      </div>
      {/* helper text intentionally removed per request */}

      {/* Collage preview: tight grid, no borders, slight overlap */}
      <div className="grid grid-cols-6 auto-rows-[60px] gap-0" style={{ overflow: "visible" }}>
        {preview.map((it, i) => (
          <Tile
            key={i}
            idx={i}
            item={it}
            canEdit={isOwner}
            onReplace={() => openAddDialog({ replaceAt: i })}
            onRemove={() => removeAt(i)}
            onResize={() => resizeAt(i)}
            sizeClasses={SIZE_CLASSES}
            overlap={OVERLAP}
            tight
          />
        ))}

        {isOwner &&
          Array.from({ length: Math.max(0, maxPreview - preview.length) }).map((_, i) => (
            <button
              key={`empty-${i}`}
              type="button"
              onClick={handleAddTileRequest}
              className="col-span-2 row-span-2 -m-[2px] bg-zinc-900/20 text-zinc-400 hover:bg-zinc-900/40"
              title="Add moodboard item"
              style={{ outline: "none" }}
            >
              <div className="flex h-full w-full items-center justify-center">
                <Plus className="h-6 w-6" />
              </div>
            </button>
          ))}
      </div>

      {/* Fullscreen modal */}
      {open && (
        <FullscreenModal onClose={() => setOpen(false)}>
          <div className="mx-auto max-w-6xl p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Moodboard</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-white hover:bg-zinc-900"
              >
                Close
              </button>
            </div>

            {/* Collage fullscreen: taller rows, same tight style */}
            <div className="grid grid-cols-6 auto-rows-[80px] gap-0" style={{ overflow: "visible" }}>
              {items.map((it, i) => (
                <Tile
                  key={`full-${i}`}
                  idx={i}
                  item={it}
                  canEdit={isOwner}
                  onReplace={() => openAddDialog({ replaceAt: i })}
                  onRemove={() => removeAt(i)}
                  onResize={() => resizeAt(i)}
                  sizeClasses={SIZE_CLASSES}
                  overlap={OVERLAP}
                  tight
                />
              ))}

              {isOwner && (
                <button
                  type="button"
                  onClick={handleAddTileRequest}
                  className="col-span-2 row-span-2 -m-[2px] bg-zinc-900/20 text-zinc-400 hover:bg-zinc-900/40"
                  title="Add moodboard item"
                  style={{ outline: "none" }}
                >
                  <div className="flex h-full w-full items-center justify-center">
                    <Plus className="h-6 w-6" />
                  </div>
                </button>
              )}
            </div>
          </div>
        </FullscreenModal>
      )}

      {/* Add/Replace dialog */}
      {adding && (
        <AddReplaceDialog
          initialType="image"
          onCancel={closeAddDialog}
          onConfirm={addItem}
        />
      )}

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
    </div>
  );
}

/* ---------- Helpers & Subcomponents ---------- */

function normalizeItem(it) {
  if (!it) return null;
  const size = it.size && ["s", "m", "w", "t"].includes(it.size) ? it.size : "m";
  if (it.type === "image") {
    return { type: "image", url: it.url, source: it.source || "tmdb", title: it.title || "", size };
  }
  if (it.type === "quote") {
    return { type: "quote", text: it.text || "", attribution: it.attribution || "", size };
  }
  if (it.type === "color") {
    return { type: "color", hex: cleanHex(it.hex || "#888888"), size };
  }
  if (it.type === "keyword") {
    return { type: "keyword", text: (it.text || "").slice(0, 24), size };
  }
  return { ...it, size };
}

function cleanHex(hex) {
  const s = String(hex).trim();
  if (s.startsWith("#")) return s;
  return `#${s}`;
}

// deterministic little tilt for that cutout feel
function tiltForIndex(i) {
  const angles = [-1.6, 0.8, -0.7, 1.2, -0.4, 0.6, 0, -0.9, 0.5, -0.3];
  return angles[i % angles.length];
}

function Tile({
  item,
  idx = 0,
  canEdit,
  onReplace,
  onRemove,
  onResize,
  sizeClasses,
  overlap = 2,
  tight = false,
}) {
  if (!item) return null;
  const span = sizeClasses?.[item.size] || sizeClasses?.m || "";
  const rotate = tiltForIndex(idx);

  const wrapStyle = {
    margin: tight ? `-${overlap}px` : undefined,
    transform: `rotate(${rotate}deg)`,
  };
  const wrapperCls =
    "group relative overflow-visible select-none will-change-transform hover:z-20 hover:scale-[1.01] transition-transform";

  if (item.type === "image") {
    return (
      <div className={`${wrapperCls} ${span}`} style={wrapStyle}>
        {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
        <img
          src={item.url}
          alt={item.title || "Moodboard image"}
          className="h-full w-full object-cover"
          loading="lazy"
          style={{ display: "block" }}
        />
        {canEdit && <TileControls onReplace={onReplace} onRemove={onRemove} onResize={onResize} />}
      </div>
    );
  }

  if (item.type === "quote") {
    return (
      <div className={`${wrapperCls} ${span}`} style={wrapStyle}>
        <div className="flex h-full w-full items-center justify-center text-center bg-black/35 backdrop-blur-[1px] px-3 py-2">
          <blockquote className="text-sm sm:text-base italic text-zinc-100 drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
            “{item.text}”
            {item.attribution ? (
              <span className="mt-1 block text-xs not-italic text-zinc-200">— {item.attribution}</span>
            ) : null}
          </blockquote>
        </div>
        {canEdit && <TileControls onReplace={onReplace} onRemove={onRemove} onResize={onResize} />}
      </div>
    );
  }

  if (item.type === "color") {
    return (
      <div className={`${wrapperCls} ${span}`} style={{ ...wrapStyle, backgroundColor: item.hex || "#888888" }}>
        <div className="absolute bottom-1 right-1 rounded bg-black/50 px-2 py-0.5 text-[10px] leading-none text-white">
          {item.hex}
        </div>
        {canEdit && <TileControls onReplace={onReplace} onRemove={onRemove} onResize={onResize} />}
      </div>
    );
  }

  if (item.type === "keyword") {
    return (
      <div className={`${wrapperCls} ${span}`} style={wrapStyle}>
        <div className="flex h-full w-full items-center justify-center">
          <span className="bg-black/60 px-3 py-1 text-sm font-semibold uppercase tracking-wide text-white">
            {item.text}
          </span>
        </div>
        {canEdit && <TileControls onReplace={onReplace} onRemove={onRemove} onResize={onResize} />}
      </div>
    );
  }

  return null;
}

function TileControls({ onReplace, onRemove, onResize }) {
  return (
    <div className="absolute inset-x-2 top-2 flex justify-end gap-2 opacity-0 transition group-hover:opacity-100">
      <button
        type="button"
        onClick={onResize}
        className="rounded-md bg-black/70 px-2 py-1 text-xs text-white hover:bg-black/90"
        title="Resize"
      >
        Resize
      </button>
      <button
        type="button"
        onClick={onReplace}
        className="rounded-md bg-black/70 px-2 py-1 text-xs text-white hover:bg-black/90"
      >
        Replace
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md bg-black/70 px-2 py-1 text-xs text-red-300 hover:bg-black/90"
        title="Remove"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function FullscreenModal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm">
      <div className="absolute right-4 top-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-white hover:bg-zinc-900"
        >
          <X className="h-4 w-4" />
          Close
        </button>
      </div>
      <div className="h-full w-full overflow-auto">{children}</div>
    </div>
  );
}

/* ---------------- Add/Replace Dialog ---------------- */
function AddReplaceDialog({ onCancel, onConfirm, initialType = "image" }) {
  const [tab, setTab] = useState(initialType);

  // Quote / Color / Keyword
  const [qText, setQText] = useState("");
  const [qAttr, setQAttr] = useState("");
  const [hex, setHex] = useState("#86efac");
  const [kw, setKw] = useState("");

  // TMDB search (shared helper)
  const [q, setQ] = useState("");

  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [tmdbErr, setTmdbErr] = useState("");

  async function searchTMDBLocal() {
    setTmdbErr("");
    setResults([]);
    const text = q.trim();
    if (!text) return;
    setSearching(true);
    try {
      const list = await searchMovies(text);
      setResults(list);
    } catch (e) {
      console.error("TMDB fetch failed:", e);
      setTmdbErr("Network error.");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function handleConfirm() {
    if (tab === "quote" && qText.trim()) {
      onConfirm({ type: "quote", text: qText.trim(), attribution: qAttr.trim() });
      onCancel();
      return;
    }
    if (tab === "color" && hex.trim()) {
      onConfirm({ type: "color", hex: hex.trim() });
      onCancel();
      return;
    }
    if (tab === "keyword" && kw.trim()) {
      onConfirm({ type: "keyword", text: kw.trim() });
      onCancel();
      return;
    }
    // Image flow handled by clicking a result
    onCancel();
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <button
              type="button"
              onClick={() => setTab("image")}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${tab === "image" ? "bg-zinc-800 text-white" : "hover:bg-zinc-900"}`}
              title="Image"
            >
              <Upload className="h-4 w-4" /> Image
            </button>
            <button
              type="button"
              onClick={() => setTab("quote")}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${tab === "quote" ? "bg-zinc-800 text-white" : "hover:bg-zinc-900"}`}
              title="Quote"
            >
              <Type className="h-4 w-4" /> Quote
            </button>
            <button
              type="button"
              onClick={() => setTab("color")}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${tab === "color" ? "bg-zinc-800 text-white" : "hover:bg-zinc-900"}`}
              title="Color"
            >
              <Palette className="h-4 w-4" /> Color
            </button>
            <button
              type="button"
              onClick={() => setTab("keyword")}
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${tab === "keyword" ? "bg-zinc-800 text-white" : "hover:bg-zinc-900"}`}
              title="Keyword"
            >
              <Search className="h-4 w-4" /> Keyword
            </button>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-700 px-2 py-1 text-sm text-white hover:bg-zinc-900"
          >
            Cancel
          </button>
        </div>

        <div className="p-4">
          {tab === "image" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <div className="text-xs text-zinc-500">
                  Add images via TMDB search below. Expanded TMDB image sets are coming soon!
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm text-zinc-300">TMDB Search</label>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-lg border border-zinc-700 bg-black/40 p-2 text-sm text-white outline-none"
                    placeholder="Search films…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={searchTMDBLocal}
                    className="rounded-lg border border-zinc-700 px-3 text-sm text-white hover:bg-zinc-900"
                    title="Search"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {searching ? (
                    <div className="col-span-3 h-24 animate-pulse rounded-md bg-zinc-900" />
                  ) : (
                    results.map((m) => {
                      const poster = m?.backdropUrl || m?.posterUrl || "";
                      if (!poster) return null;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            onConfirm({
                              type: "image",
                              url: poster,
                              title: m.title || "",
                              source: "tmdb",
                            });
                            onCancel(); // close after picking
                          }}
                          className="aspect-[2/3] overflow-hidden rounded-md border border-zinc-800 hover:ring-2 hover:ring-yellow-500"
                          title="Use this image"
                        >
                          <img
                            src={poster}
                            alt="TMDB result"
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      );
                    })
                  )}
                </div>

                {tmdbErr ? <p className="mt-2 text-xs text-red-400">{tmdbErr}</p> : null}
              </div>
            </div>
          )}

          {tab === "quote" && (
            <div className="grid gap-4">
              <div>
                <label className="block text-sm text-zinc-300">Quote</label>
                <textarea
                  rows={3}
                  className="w-full rounded-lg border border-zinc-700 bg-black/40 p-2 text-sm text-white outline-none"
                  placeholder="“Cinema is a matter of what's in the frame and what's out.”"
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-300">Attribution (optional)</label>
                <input
                  className="w-full rounded-lg border border-zinc-700 bg-black/40 p-2 text-sm text-white outline-none"
                  placeholder="Martin Scorsese"
                  value={qAttr}
                  onChange={(e) => setQAttr(e.target.value)}
                />
              </div>
            </div>
          )}

          {tab === "color" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm text-zinc-300">Hex</label>
                <input
                  className="w-full rounded-lg border border-zinc-700 bg-black/40 p-2 text-sm text-white outline-none"
                  placeholder="#FFD700"
                  value={hex}
                  onChange={(e) => setHex(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-center">
                <div
                  className="h-20 w-32 rounded-lg border border-zinc-700"
                  style={{ backgroundColor: hex || "#888888" }}
                />
              </div>
            </div>
          )}

          {tab === "keyword" && (
            <div className="grid gap-4">
              <div>
                <label className="block text-sm text-zinc-300">Keyword</label>
                <input
                  className="w-full rounded-lg border border-zinc-700 bg-black/40 p-2 text-sm text-white outline-none"
                  placeholder="Slow Cinema"
                  value={kw}
                  onChange={(e) => setKw(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-800 px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-white hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-md bg-yellow-500 px-3 py-1.5 text-sm font-medium text-black hover:bg-yellow-400"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
