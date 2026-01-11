// src/pages/ClubProfile.jsx — avatar upload + 90-day rename (presidents only)
import React, { lazy, Suspense, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  MapPin,
  Film,
  Star,
  ImagePlus,
  Crop as CropIcon,
  CalendarClock,
  Trash2,
  Shield,
  Info,
  MoreHorizontal,
  LogOut,
} from "lucide-react";

import { useUser } from "../context/UserContext";
import "react-datepicker/dist/react-datepicker.css";
import supabase from "../supabaseClient.js";
import TmdbImage from "../components/TmdbImage";
import uploadAvatar from "../lib/uploadAvatar";
import { toast } from "react-hot-toast";
import useStaff from "../hooks/useStaff";
import { searchMovies } from "../lib/tmdbClient";
import AspectPicker from "../components/AspectPicker";
import { ASPECTS } from "../constants/aspects";
import FilmAverageCell from "../components/FilmAverageCell.jsx";
import DatePicker from "react-datepicker";
import { leaveClubAndMaybeDelete } from "../lib/leaveClub";




// keep these eager (used above the fold / core to page)
import ClubAboutCard from "../components/ClubAboutCard.jsx";
import ClubFilmTakesSection from "../components/ClubFilmTakesSection.jsx";
import ClubChatTeaserCard from "../components/ClubChatTeaserCard";
import JoinClubButton from "../components/JoinClubButton";
import DirectorsCutBadge from "../components/DirectorsCutBadge";
import PartnerBadge from "../components/PartnerBadge.jsx";

// lazy: below-the-fold / admin-ish / heavy
const ClubNoticeBoard = lazy(() => import("../components/ClubNoticeBoard"));
const FeaturedFilms = lazy(() => import("../components/FeaturedFilms.jsx"));
const ClubYearInReview = lazy(() => import("../components/ClubYearInReview.jsx"));
const NominationsCarousel = lazy(() => import("../components/NominationsCarousel.jsx"));
const RecentPointAwards = lazy(() => import("../components/RecentPointAwards.jsx"));
const BannerCropper = lazy(() => import("../components/BannerCropper"));
const PartnerPointsReviewPanel = lazy(() =>
  import("../components/PartnerPointsReviewPanel.jsx")
);
const PartnerChatAuditPanel = lazy(() =>
  import("../components/PartnerChatAuditPanel.jsx")
);
const AvatarCropper = lazy(() => import("../components/AvatarCropper"));







// at top with other imports




























// UUID detector
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLUB_CACHE_TTL = 1000 * 60 * 5; // 5 minutes
const clubCacheKey = (id) => `sf.club.cache.v1:${id}`;
const CLUB_BANNER_ASPECT = 1152 / 276;

const readClubCache = (id) => {
  if (!id) return null;
  try {
    const raw = localStorage.getItem(clubCacheKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !parsed?.data) return null;
    if (Date.now() - parsed.ts > CLUB_CACHE_TTL) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeClubCache = (id, data) => {
  if (!id || !data) return;
  try {
    localStorage.setItem(
      clubCacheKey(id),
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch {
    // ignore storage write failures (private mode, quota)
  }
};





/* -----------------------------
   Ticket UI
------------------------------*/
const TicketCard = ({ title, tagline, location, datetime, onClick }) => (
  <div
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onClick={onClick}
    onKeyDown={(e) => {
      if (!onClick) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick();
      }
    }}
    className={[
      'relative rounded-2xl bg-zinc-900/85 border border-zinc-800 text-white p-4 sm:p-5 shadow-lg overflow-hidden',
      onClick
        ? 'cursor-pointer transition-transform duration-200 will-change-transform hover:scale-[1.02] hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-yellow-500 active:scale-[0.99]'
        : '',
    ].join(' ')}
    aria-label={onClick ? `View attendance for ${title}` : undefined}
  >
    <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-yellow-400 to-yellow-500" />
    <span className="absolute -left-3 top-8 w-6 h-6 rounded-full bg-black border border-zinc-800" />
    <span className="absolute -left-3 bottom-8 w-6 h-6 rounded-full bg-black border border-zinc-800" />
    <span className="absolute -right-3 top-8 w-6 h-6 rounded-full bg-black border border-zinc-800" />
    <span className="absolute -right-3 bottom-8 w-6 h-6 rounded-full bg-black border border-zinc-800" />

    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
      <div>
        <div className="text-yellow-400 font-semibold text-xs uppercase tracking-[0.15em] mb-1">
          Screening
        </div>
        <h3 className="text-xl font-bold leading-snug">{title}</h3>
        {tagline && <p className="text-sm text-zinc-300 mt-1">{tagline}</p>}

        <div className="flex flex-col gap-2 mt-4 text-sm">
          {location && (
            <div className="inline-flex items-center gap-2 bg-zinc-800/70 rounded-full px-3 py-1 w-fit">
              <MapPin className="w-4 h-4 text-yellow-400" />
              <span className="text-zinc-200">{location}</span>
            </div>
          )}
          {datetime && (
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-yellow-400" />
              <span className="text-zinc-200">{datetime}</span>
            </div>
          )}
        </div>
      </div>

      <div className="relative flex flex-col items-center md:items-end">
        <div
          className="absolute -left-4 top-0 bottom-0 w-4 hidden md:block"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to bottom, rgba(234,179,8,0.16) 0 6px, rgba(255,255,255,0) 6px 7px)',
          }}
        />
        <div className="mt-1 md:mt-0 bg-white p-2 rounded-md" aria-hidden="true">
          <svg width="94" height="40" viewBox="0 0 94 40">
            <rect width="94" height="40" fill="#fff" />
            {[2,6,8,12,15,18,22,25,28,31,34,38,41,44,47,50,53,56,60,63,66,70,73,76,80,83,86,89].map((x, i) => (
              <rect key={i} x={x} y="4" width={i % 3 === 0 ? 3 : 2} height="32" fill="#000" />
            ))}
          </svg>
        </div>
        <div className="text-[10px] text-zinc-400 mt-1 tracking-widest">ADMIT•ONE</div>
      </div>
    </div>
  </div>
);



/* -----------------------------
   Helpers
------------------------------*/
const fallbackNext = '/fallback-next.jpg';
const fallbackBanner = '/fallback-banner.jpg';
const fallbackAvatar = '/default-avatar.svg';
const fallbackLegacy = '/fallback-next.jpg'; // replaces any old test.jpg/blob fallback

const isBadPoster = (src) => {
  if (typeof src !== "string") return false;
  const s = src.trim();
  return s === "test.jpg" || s === "/test.jpg" || s.endsWith("/test.jpg");
};

// Normalize poster path/URL handling so we only persist TMDB paths (no size) and render w500 URLs once
const stripTmdbSizePrefix = (path) =>
  path.replace(/^\/?w(45|92|154|185|300|342|500|780|1280)\//i, "/").replace(/^\/+/, "/");

const extractTmdbPath = (poster) => {
  if (!poster || typeof poster !== "string") return null;
  if (isBadPoster(poster)) return null;
  if (poster.includes("image.tmdb.org/t/p/")) {
    const [, suffixRaw] = poster.split("image.tmdb.org/t/p/");
    if (!suffixRaw) return null;
    return stripTmdbSizePrefix(`/${suffixRaw}`);
  }
  if (poster.startsWith("/")) return stripTmdbSizePrefix(poster);
  return null;
};

const normalizeTmdbPoster = (poster) => {
  const path = extractTmdbPath(poster);
  if (!path) return { path: null, url: null };
  return { path, url: `https://image.tmdb.org/t/p/w500${path}` };
};

const safeImageSrc = (src, fallback) => {
  if (!src) return fallback;
  if (typeof src === "string" && src.startsWith("blob:")) {
    return fallback;
  }
  if (isBadPoster(src)) return fallbackLegacy;
  return src;
};

// Upload any blob/dataURL to Supabase storage and return a cache-busted public URL
// Convert various cropper outputs to a Blob
async function normalizeToBlob(result) {
  // Already a Blob/File
  if (result instanceof Blob || result instanceof File) return result;

  // data URL string ("data:image/jpeg;base64,...")
  if (typeof result === "string" && result.startsWith("data:")) {
    const res = await fetch(result);
    return await res.blob();
  }

  // object URL or http(s) URL (e.g., "blob:..." or "https://...")
  if (typeof result === "string" && (result.startsWith("blob:") || result.startsWith("http"))) {
    const res = await fetch(result);
    return await res.blob();
  }

  // Common wrappers: { blob }, { file }, { base64, mime }
  if (result && typeof result === "object") {
    if (result.blob instanceof Blob) return result.blob;
    if (result.file instanceof File) return result.file;

    if (typeof result.base64 === "string") {
      const mime = result.mime || "image/jpeg";
      // ensure it’s a proper data URL
      const dataUrl = result.base64.startsWith("data:")
        ? result.base64
        : `data:${mime};base64,${result.base64}`;
      const res = await fetch(dataUrl);
      return await res.blob();
    }

    // Canvas from some croppers: { canvas: HTMLCanvasElement }
    if (result.canvas && typeof result.canvas.toBlob === "function") {
      const type = result.type || "image/jpeg";
      const quality = typeof result.quality === "number" ? result.quality : 0.9;
      const blob = await new Promise((resolve) =>
        result.canvas.toBlob((b) => resolve(b), type, quality)
      );
      if (blob) return blob;
    }

    // Function form: { toBlob: fn(cb) } or async toBlob()
    if (typeof result.toBlob === "function") {
      const type = result.type || "image/jpeg";
      const quality = typeof result.quality === "number" ? result.quality : 0.9;
      const maybeBlob = await new Promise((resolve) =>
        result.toBlob((b) => resolve(b), type, quality)
      );
      if (maybeBlob) return maybeBlob;
    }
  }

  throw new Error("Unsupported crop result format");
}

// Upload any blob-like to Supabase storage and return a cache-busted public URL
async function uploadToBucket({ bucket, path, file, contentType = "image/jpeg" }) {
  const blob = await normalizeToBlob(file);
  const inferredType = blob.type || contentType;

  const { error: upErr } = await supabase.storage.from(bucket).upload(path, blob, {
    upsert: true,
    contentType: inferredType,
  });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const url = data?.publicUrl;
  return url ? `${url}?v=${Date.now()}` : null;
}

const cleanTitleForSearch = (title) =>
  title.replace(/screening of/gi, '').replace(/discussion night/gi, '').replace(/['"]/g, '').trim();

const fetchPosterFromTMDB = async (title) => {
     try {
       const q = String(title || "").trim();
     if (!q) return null;
       const hits = await searchMovies(q); // secure: via Supabase Edge Function
       const first = Array.isArray(hits) ? hits[0] : null; // { id, title, year, posterUrl, backdropUrl }
       if (!first) return null;
       const poster =
         first.posterUrl ||
         (first.backdropUrl ? first.backdropUrl.replace("/w780/", "/w500/") : "");
       if (!poster) return null;
       return { poster, id: first.id, title: first.title };
     } catch {
      return null;
     }
   };

function getCountdown(eventDateStr) {
  const eventDate = new Date(eventDateStr);
  const now = new Date();
  const diff = eventDate - now;
  if (isNaN(diff) || diff <= 0) return null;
  const minutes = Math.floor(diff / 60000) % 60;
  const hours = Math.floor(diff / 3600000) % 24;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return { days, hours, minutes, isUrgent: diff < 3600000 };
}

const ROLE = { PRESIDENT: 'president', VICE: 'vice_president', NONE: null };



function mapClubRowToUI(row) {
  if (!row) {
    return {
      id: null,
      slug: null,
      name: "",
      tagline: "",
      about: "",
      location: "",
      banner: fallbackBanner,
      profileImageUrl: "",
      nameLastChangedAt: null,
      nextEvent: null,
      featuredFilms: [],
      featuredMap: {},
      membersList: [],
      members: 0,
      activityFeed: [],
    };
  }

  const nextEvent = row.next_screening
    ? {
        title: row.next_screening.film_title || "Screening",
        date: row.next_screening.screening_at || null,
        location: row.next_screening.location || row.location || "",
        caption: row.next_screening.caption || "",
        poster: normalizeTmdbPoster(row.next_screening.film_poster).url || null,
        movieId: row.next_screening.film_id || null,
        attendingCount: Number(row?.next_screening?.attending_count) || 0,
        primeLocation: row.next_screening.location || row.location || "",
        genreFocus: Array.isArray(row.genre_focus) ? row.genre_focus : [],
        meetingSchedule: row.meeting_schedule || "",
      }
    : null;

  return {
    id: row.id,
    slug: row.slug || null,
    name: row.name,
    tagline: row.tagline || "",
    about: row.about || "",
    location: row.location || "",
    banner: safeImageSrc(row.banner_url, fallbackBanner),
    profileImageUrl: safeImageSrc(row.profile_image_url, ""),
    nameLastChangedAt: row.name_last_changed_at || null,

    // ---------------------------------------------------------------
    // NEXT EVENT (now correctly pulled ONLY from club_next_screening)
    // ---------------------------------------------------------------
    nextEvent,

    // -----------------------
    // Featured Films (unchanged)
    // -----------------------
    featuredFilms: Array.isArray(row.featured_posters)
      ? row.featured_posters
      : [],
    featuredMap: {}, // posterUrl -> { id, title }

    // -----------------------
    // Members (unchanged)
    // -----------------------
    membersList: [],
    members: 0,
    activityFeed: [],
  };
}




function MembersDialog({
  onClose,
  members,
  memberSearch,
  setMemberSearch,
  isPresident,
  hasRole,
  user,
  setMemberRole,
  transferPresidency,
}) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl max-w-3xl w-full p-6 relative">
        <button
          className="absolute top-3 right-3 text-neutral-400 hover:text-white"
          onClick={onClose}
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold mb-4 text-white">
          Members • {members.length}
        </h2>

        <input
          value={memberSearch}
          onChange={(e) => setMemberSearch(e.target.value)}
          placeholder="Search members…"
          className="w-full rounded-xl bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none ring-1 ring-neutral-800 focus:ring-yellow-500 mb-4"
          aria-label="Search members"
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {members
            .filter(
              (m) =>
                !memberSearch ||
                (m.profiles?.display_name || "")
                  .toLowerCase()
                  .includes(memberSearch.toLowerCase())
            )
            .map((m) => {
              const p = m.profiles || {};
              const name = p.display_name || "Member";
              const avatar = safeImageSrc(p.avatar_url, "/default-avatar.svg");
              const role = m.role;

              return (
                <div
                  key={p.id || m.user_id}
                  className="flex items-center gap-3 rounded-xl bg-neutral-900/60 p-2 ring-1 ring-neutral-800"
                >
                  <img
                    src={avatar}
                    alt={name}
                    className="h-10 w-10 rounded-full"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/default-avatar.svg";
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-neutral-100 flex items-center gap-2">
                      {name}
                      {role === "president" && (
                        <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" title="President" />
                      )}
                      {role === "vice_president" && (
                        <span className="w-3 h-3 rounded-full bg-gray-400 inline-block" title="Vice President" />
                      )}
                    </p>
                  </div>

                  {(isPresident || hasRole("president")) && p.id !== user?.id && (
                    <div className="ml-auto flex items-center gap-2">
                      {role === "vice_president" ? (
                        <button
                          onClick={() => setMemberRole(p.id, "member")}
                          className="text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
                        >
                          Remove VP
                        </button>
                      ) : (
                        <button
                          onClick={() => setMemberRole(p.id, "vice_president")}
                          className="text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
                        >
                          Make VP
                        </button>
                      )}

                      {role !== "president" && (
                        <button
                          onClick={() => transferPresidency(p.id)}
                          className="text-[11px] px-2 py-1 rounded bg-yellow-500 text-black hover:bg-yellow-400"
                        >
                          Make President
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

          {members.filter(
            (m) =>
              !memberSearch ||
              (m.profiles?.display_name || "")
                .toLowerCase()
                .includes(memberSearch.toLowerCase())
          ).length === 0 && (
            <p className="col-span-full text-sm text-neutral-400">
              No members match “{memberSearch}”.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}



  

  
function useFilmTakes() {
  const { user, profile, saveProfilePatch, isPartner, hasRole, sessionLoaded } = useUser();

  async function addTake({ text, rating_5 = null, aspect_key = null, movie, club }) {
    if (!user?.id) throw new Error("Not signed in");
    const current = Array.isArray(profile?.film_takes) ? profile.film_takes : [];

    const payload = {
      id: crypto.randomUUID(),
      user_id: user.id,
      text: String(text || "").trim(),
      rating_5: typeof rating_5 === "number" ? rating_5 : null, // half-star OK
      aspect_key: aspect_key || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      movie: movie
        ? {
            id: movie.id ?? null,
            title: movie.title ?? movie.name ?? null,
            year: movie.year ?? null,
            poster: movie.poster
  ? movie.poster.replace("https://image.tmdb.org/t/p/w500", "")
  : null,
          }
        : null,
      club: club
        ? {
            id: club.id ?? null,
            name: club.name ?? null,
            slug: club.slug ?? null,
          }
        : null,
      club_context: !!club,
    };

    const next = [payload, ...current];
    await saveProfilePatch({ film_takes: next });
    return next;
  }

  return { addTake };
}



// ...

// REPLACE your existing ClubAddTake function with this whole block
function ClubAddTake({ movie, club }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [rating, setRating] = useState(null); // 0.5–5.0
  const [aspect, setAspect] = useState(null); // key from ASPECTS
  const [busy, setBusy] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  const { user } = useUser();
  const { addTake } = useFilmTakes();

  // ✅ Hooks must come before any early return
  useEffect(() => {
    function onOpen(e) {
      const preset = e?.detail?.preset ?? "";
      const r = e?.detail?.rating ?? null;
      setText(preset);
      setRating(typeof r === "number" ? r : null);
      setOpen(true);
    }
    window.addEventListener("open-take-editor", onOpen);
    return () => window.removeEventListener("open-take-editor", onOpen);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.id || !club?.id || !movie?.id) {
        if (active) setHasExisting(false);
        return;
      }
      const { count } = await supabase
        .from("club_film_takes")
        .select("*", { count: "exact", head: true })
        .eq("club_id", club.id)
        .eq("user_id", user.id)
        .eq("film_id", Number(movie.id))
        .eq("is_archived", false);
      if (active) setHasExisting((count || 0) > 0);
    })();
    return () => { active = false; };
  }, [user?.id, club?.id, movie?.id]);

  // ✅ Early return AFTER hooks (now it's not conditional for the hooks)
  if (!user) return null;

  async function save() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await addTake({
        text,
        rating_5: typeof rating === "number" ? rating : null,
        aspect_key: aspect || null,
        movie,
        club,
      });

      if (movie?.id && club?.id) {
        const payload = {
          club_id: club.id,
          user_id: user.id,
          film_id: Number(movie.id),
          screening_id: null,
          film_title: movie.title ?? null,
          poster_path: movie.poster
  ? movie.poster.replace("https://image.tmdb.org/t/p/w500", "")
  : null,
          rating: rating != null ? Number((Number(rating) * 2).toFixed(1)) : null, // 0–10
          take: text.trim(),
          is_archived: false,
        };

        const { data: row, error: takeErr } = await supabase
          .from("club_film_takes")
          .upsert(payload, {
            onConflict: "club_id,user_id,film_id",
            ignoreDuplicates: false,
          })
          .select(`
            id, club_id, user_id, film_id, rating, take, is_archived, created_at,
            profiles:profiles!user_id ( display_name, avatar_url )
          `)
          .maybeSingle();

        if (takeErr) {
          console.error("[club_film_takes upsert] failed:", takeErr);
          alert(takeErr.message || "Could not save your take (RLS or membership?)");
          return;
        }

        window.dispatchEvent(
          new CustomEvent("club-film-takes-updated", {
            detail: { clubId: club.id, filmId: Number(movie.id), row },
          })
        );
        setHasExisting(true);
      }

      setText("");
      setRating(null);
      setAspect(null);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-300 to-amber-500 px-3 py-2 text-sm font-semibold text-black shadow-[0_12px_28px_rgba(250,204,21,0.25)] hover:shadow-[0_14px_34px_rgba(250,204,21,0.35)] focus:outline-none focus:ring-2 focus:ring-yellow-400/70"
        >
          {hasExisting ? "Edit your take" : "Add your take"}
        </button>
      ) : (
        <div className="rounded-xl border border-zinc-800 p-3 bg-black/40">
          <label className="block text-xs uppercase tracking-wide text-zinc-400">
            Which craft shone brightest?
          </label>
          <AspectPicker value={aspect} onChange={setAspect} className="mt-1" />

          <label className="mt-3 block text-xs uppercase tracking-wide text-zinc-400">
            Rating
          </label>
          <input
            type="number"
            min="0.5"
            max="5"
            step="0.5"
            value={rating ?? ""}
            onChange={(e) => setRating(e.target.value ? Number(e.target.value) : null)}
            placeholder="e.g. 3.5"
            className="mt-1 w-24 bg-zinc-900/60 p-2 rounded text-sm text-white outline-none"
          />

          <textarea
            className="mt-3 w-full resize-none rounded-md bg-zinc-900/60 p-2 text-sm text-white outline-none"
            rows={3}
            placeholder={`Your take on ${movie?.title || "this film"}…`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="mt-2 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy || !text.trim()}
              className="rounded-lg bg-yellow-500 px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
            >
              {busy ? "Saving…" : (hasExisting ? "Save changes" : "Post take")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmModal({ title, body, confirmLabel, cancelLabel = "Cancel", onConfirm, onClose, busy }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-sm p-5 relative shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
        <p className="text-sm text-zinc-300 mb-4 leading-relaxed">{body}</p>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-zinc-800 text-sm text-zinc-200 hover:bg-zinc-700"
          >
            {cancelLabel}
          </button>

          <button
            disabled={busy}
            onClick={onConfirm}
            className="px-3 py-1.5 rounded bg-yellow-500 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}




/* -----------------------------
   Component
------------------------------*/
export default function ClubProfile() {

  // --- Club review (collective) ---
const [openReview, setOpenReview] = useState(null); // current open review row (if any)
const [rating, setRating] = useState(null);         // member rating 0..5
const [text, setText] = useState("");               // member blurb
const [aspect, setAspect] = useState(null);  // standout craft key
  // 0.5–5.0
        // blurb
  
        const { user, profile, saveProfilePatch, isPartner, hasRole, sessionLoaded } = useUser();

  const [isMember, setIsMember] = useState(false);
  const [showLazy, setShowLazy] = useState(false);

  const { id: routeId, clubParam } = useParams();
  const idParam = (clubParam || routeId || '').trim();
  const navigate = useNavigate();


  const [club, setClub] = useState(() => readClubCache(idParam));

// --- Next Screening state ---
const [nextScreening, setNextScreening] = useState(null);
  const [savingNext, setSavingNext] = useState(false);
  const [partnerToolsOpen, setPartnerToolsOpen] = useState(false);

  useEffect(() => {
    let handle;
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      handle = window.requestIdleCallback(() => setShowLazy(true), { timeout: 800 });
    } else {
      const t = setTimeout(() => setShowLazy(true), 400);
      handle = { timeoutId: t, isTimeout: true };
    }
    return () => {
      if (handle) {
        if (handle.isTimeout) clearTimeout(handle.timeoutId);
        else window.cancelIdleCallback?.(handle);
      }
    };
  }, []);

const saveNextScreening = async () => {
  if (savingNext) return;
  console.info("[nextScreening] save clicked", {
    nextScreening,
    persistedPosterPath,
  });

  if (!club?.id) {
    console.warn("No club.id — aborting save");
    toast.error("No club ID — refresh and try again.");
    return;
  }

  if (!nextScreening) {
    console.warn("No nextScreening state — aborting");
    toast.error("Nothing to save yet.");
    return;
  }

  // Keep previously saved path if the current UI poster is a fallback/null
  // Build the film_poster we will persist (TMDB path only)
  let posterForStorage =
    nextScreening?.posterPath ??
    extractTmdbPath(nextScreening.poster) ??
    persistedPosterPath ??
    null;

  // If we have a title but no poster path yet, try to fetch a TMDB poster before saving
  if (!posterForStorage && nextScreening.title) {
    try {
      const guess = await fetchPosterFromTMDB(cleanTitleForSearch(nextScreening.title));
      const guessedUrl = guess?.poster || null;
      posterForStorage = extractTmdbPath(guessedUrl) ?? null;
      if (posterForStorage) {
        setNextScreening((prev) => ({
          ...(prev || {}),
          poster: normalizeTmdbPoster(posterForStorage).url || prev?.poster,
          posterPath: posterForStorage,
        }));
      }
    } catch (err) {
      console.warn("[nextScreening] poster prefetch failed:", err);
    }
  }

  // Ignore known fallbacks/bad values
  if (posterForStorage && posterForStorage.includes("fallback-next")) {
    posterForStorage = null;
  }

  // Convert React state → DB row
  const payload = {
    club_id: club.id,
    film_id: nextScreening.filmId ?? null,
    film_title: nextScreening.title ?? null,
    film_poster: posterForStorage,
    screening_at: nextScreening.date ?? null,
    location: nextScreening.location ?? null,
    caption: nextScreening.caption ?? null,
  };

  console.info("🔥 Payload to save:", payload);
  toast.loading("Saving next screening…", { id: "next-save" });

  setSavingNext(true);
  const { data, error } = await supabase
    .from("club_next_screening")
    .upsert(payload, { onConflict: "club_id" })
    .select()
    .maybeSingle();

  if (error) {
    console.error("❌ Save failed:", error);
    toast.error(error.message || "Could not save next screening.", { id: "next-save" });
    setSavingNext(false);
    return;
  }

  console.log("✅ Saved row:", data);
  toast.success("Next screening saved", { id: "next-save" });

  // Update local state so UI reflects DB
  const normalized = normalizeTmdbPoster(data.film_poster);
  const posterUrl = normalized.url || fallbackNext;
  setNextScreening({
    filmId: data.film_id,
    title: data.film_title,
    poster: posterUrl,
    posterPath: normalized.path ?? nextScreening?.posterPath ?? null,
    date: data.screening_at,
    location: data.location,
    caption: data.caption,
    id: data.id,
  });

  // Keep club.nextEvent in sync for any components that still read from it
  setClub((prev) =>
    prev
      ? {
          ...prev,
          nextEvent: {
            ...(prev.nextEvent || {}),
            title: data.film_title,
            date: data.screening_at,
            location: data.location,
            caption: data.caption,
            poster: posterUrl || prev.nextEvent?.poster,
            movieId: data.film_id,
          },
        }
      : prev
  );

  // Best-effort cleanup: if the table is missing a UNIQUE constraint on club_id,
  // previous saves may have created extra rows. Remove any siblings so reloads
  // can safely pick a single record.
  try {
    await supabase
      .from("club_next_screening")
      .delete()
      .eq("club_id", club.id)
      .neq("id", data.id);
  } catch (cleanupErr) {
    console.warn("[nextScreening] cleanup duplicate rows failed:", cleanupErr);
  }

  // Track which film is persisted (used elsewhere)
  setPersistedFilmId(data.film_id ?? null);
  setPersistedPosterPath(normalized.path ?? nextScreening?.posterPath ?? null);
  setSavingNext(false);
};


// Derived values
const nextFilmId = nextScreening?.filmId || null;
const nextPoster = nextScreening?.poster || null;
const nextTitle  = nextScreening?.title || null;

  const nextFilmAverage = club?.nextEvent?.average ?? club?.nextEvent?.avg ?? null;
  const [loading, setLoading] = useState(() => !readClubCache(idParam));
  const [notFound, setNotFound] = useState(false);
  const [lastAdded, setLastAdded] = useState(null);
  // Tracks the film_id currently persisted in DB (for archiving takes on change)
const [persistedFilmId, setPersistedFilmId] = useState(null);
const [persistedPosterPath, setPersistedPosterPath] = useState(null);



  // debug info
  const [debugParam, setDebugParam] = useState('');
  const [lastError, setLastError] = useState(null);
  const [lastTried, setLastTried] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [featuredSearch, setFeaturedSearch] = useState('');
  const [featuredResults, setFeaturedResults] = useState([]);
  const [showFeaturedTip, setShowFeaturedTip] = useState(false);
  const [nextSearch, setNextSearch] = useState('');
  const [nextSearchResults, setNextSearchResults] = useState([]);

  const [showBannerCropper, setShowBannerCropper] = useState(false);
  const [rawBannerImage, setRawBannerImage] = useState(null);
  // NEW: avatar crop state
const [showAvatarCropper, setShowAvatarCropper] = useState(false);
const [rawAvatarImage, setRawAvatarImage] = useState(null);


  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  // NEW: avatar + rename UI state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
const [renameError, setRenameError] = useState('');
const [renameOk, setRenameOk] = useState('');
const [newName, setNewName] = useState('');
  // --- poster ↔ teaser height sync ---
const posterRef = useRef(null);
const teaserWrapRef = useRef(null);
const [teaserHeight, setTeaserHeight] = useState(null);
const [members, setMembers] = useState([]);
const membersCount = useMemo(
  () => (Array.isArray(members) ? members.length : Number(club?.members) || 0),
  [members, club?.members]
);
const [membersLoading, setMembersLoading] = useState(true);
const [selectedResultId, setSelectedResultId] = useState(null);
const [membersErr, setMembersErr] = useState("");
const myMembership = members?.find(m => m.user_id === user?.id);
const isPresident = members?.some(
  (m) => m.user_id === user?.id && m.role === "president"
);
const { isStaff } = useStaff(club?.id);
const [nextAvg, setNextAvg] = useState(null);
const [nextRatingCounts, setNextRatingCounts] = useState([0, 0, 0, 0, 0]);
const [nextRatingTotal, setNextRatingTotal] = useState(0);
const [isClubAdmin, setIsClubAdmin] = useState(false);
const allowed = ["president", "vice", "vice_president", "admin", "moderator", "partner"];
const [tmdbBusy, setTmdbBusy] = useState(false);
const [nominations, setNominations] = useState([]);



const [isMounted, setIsMounted] = useState(false);

useEffect(() => {
  setIsMounted(true);
}, []);

useEffect(() => {
  if (!club?.id || !isEditing || !isPresident) return;
  try {
    const raw = localStorage.getItem(`sf.club.nameDraft:${club.id}`);
    if (raw) {
      setNewName(raw);
    }
  } catch {}
}, [club?.id, isEditing, isPresident]);

useEffect(() => {
  if (!club?.id || !isEditing || !isPresident) return;
  try {
    if (newName && newName !== club?.name) {
      localStorage.setItem(`sf.club.nameDraft:${club.id}`, newName);
    } else {
      localStorage.removeItem(`sf.club.nameDraft:${club.id}`);
    }
  } catch {}
}, [newName, club?.id, club?.name, isEditing, isPresident]);

// Keep member avatars in sync when the viewer updates their profile picture
useEffect(() => {
  if (!user?.id || !profile?.avatar_url) return;

  setMembers((prev) =>
    Array.isArray(prev)
      ? prev.map((m) => {
          const matches = m?.user_id === user.id || m?.profiles?.id === user.id;
          if (!matches) return m;
          const profiles = {
            ...(m.profiles || {}),
            id: m?.profiles?.id || user.id,
            avatar_url: profile.avatar_url,
          };
          return { ...m, profiles };
        })
      : prev
  );

  setClub((prev) =>
    prev
      ? {
          ...prev,
          membersList: Array.isArray(prev.membersList)
            ? prev.membersList.map((m) =>
                m.id === user.id ? { ...m, avatar: profile.avatar_url || m.avatar } : m
              )
            : prev.membersList,
        }
      : prev
  );
}, [user?.id, profile?.avatar_url]);














// re-fetch members (used after role changes)
const loadMembers = useCallback(async () => {
  if (!club?.id) return;
  try {
    // 1) raw member rows
    const { data: memRows, error: memErr } = await supabase
      .from("club_members")
      .select("user_id, role")
      .eq("club_id", club.id);

    if (memErr) throw memErr;

    const ids = (memRows || []).map(r => r.user_id).filter(Boolean);
    let profilesMap = {};

    if (ids.length) {
      // 2) fetch profiles in bulk
      const { data: profRows, error: profErr } = await supabase
        .from("profiles")
        .select("id, slug, display_name, avatar_url")
        .in("id", ids);

      if (profErr) {
        // fail-safe: keep going with empty profiles
        profilesMap = {};
      } else {
        profilesMap = Object.fromEntries(
          (profRows || []).map(p => [p.id, p])
        );
      }
    }

    // merge + sort
    const priority = { president: 0, vice_president: 1, member: 2 };
    const merged = (memRows || []).map(r => ({
      user_id: r.user_id,
      role: r.role || "member",
      profiles: profilesMap[r.user_id] || null,
    }));

    const sorted = merged.slice().sort((a, b) => {
      const pa = priority[a.role] ?? 9;
      const pb = priority[b.role] ?? 9;
      if (pa !== pb) return pa - pb;
      const an = (a.profiles?.display_name || "").toLowerCase();
      const bn = (b.profiles?.display_name || "").toLowerCase();
      return an.localeCompare(bn);
    });

    setMembers(sorted);
  } catch (e) {
    console.error("loadMembers failed:", e);
    setMembers([]);
  } finally {
    setMembersLoading(false);
  }
}, [club?.id, sessionLoaded]);






// call it on mount/club change
useEffect(() => {
  if (!club?.id) return;
  setMembersLoading(true);
  loadMembers();
}, [club?.id, loadMembers, sessionLoaded]);


// RPC helpers
const setMemberRole = async (userId, role) => {
  if (!club?.id) return;
  const { error } = await supabase.rpc("set_member_role", {
    p_club: club.id,
    p_target: userId,
    p_role: role, // 'vice_president' | 'member'
  });
  if (error) {
    toast?.error ? toast.error(error.message) : alert(error.message);
    return;
  }
  toast?.success ? toast.success("Role updated") : console.log("Role updated");
  await loadMembers();
};

const transferPresidency = async (userId) => {
  if (!club?.id) return;
  const ok = typeof window !== "undefined" ? window.confirm("Transfer presidency to this member?") : true;
  if (!ok) return;
  const { error } = await supabase.rpc("transfer_presidency", {
    p_club: club.id,
    p_new_president: userId,
  });
  if (error) {
    toast?.error ? toast.error(error.message) : alert(error.message);
    return;
  }
  toast?.success ? toast.success("Presidency transferred") : console.log("Presidency transferred");
  await loadMembers();
};

useEffect(() => {
  if (club?.id) loadMembers();
}, [club?.id, loadMembers]);














useEffect(() => {
  const sync = () => {
    const pEl = posterRef.current;
    const tEl = teaserWrapRef.current;
    if (!pEl || !tEl) return;
    const p = pEl.getBoundingClientRect();
    const t = tEl.getBoundingClientRect();
    setTeaserHeight(Math.max(0, Math.round(p.bottom - t.top)));
  };

  // initial + on resize/size changes
  requestAnimationFrame(sync);
  const roPoster = posterRef.current ? new ResizeObserver(sync) : null;
  const roTeaser = teaserWrapRef.current ? new ResizeObserver(sync) : null;
  roPoster?.observe(posterRef.current);
  roTeaser?.observe(teaserWrapRef.current);
  window.addEventListener("resize", sync, { passive: true });

  return () => {
    roPoster?.disconnect();
    roTeaser?.disconnect();
    window.removeEventListener("resize", sync);
  };
}, []);

useEffect(() => {
  let cancelled = false;
  async function fetchOpenReview() {
    if (!club?.id || !nextFilmId) {
      if (!cancelled) setOpenReview(null);
      return;
    }
    const { data, error } = await supabase
      .from("club_reviews")
      .select("id, club_id, tmdb_id, title, poster_url, year, state, opens_at, closes_at")
      .eq("club_id", club.id)
      .eq("tmdb_id", nextFilmId)
      .eq("state", "open")
      .order("opens_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cancelled) setOpenReview(error ? null : data || null);
  }
  fetchOpenReview();
  return () => {
    cancelled = true;
  };
}, [club?.id, nextFilmId]);



useEffect(() => {
  if (!club?.id) return;

  const ch = supabase
    .channel(`members:${club.id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "club_members", filter: `club_id=eq.${club.id}` },
      () => {
        // just re-use existing loader
        loadMembers();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(ch);
  };
}, [club?.id, loadMembers]);



  

  // Loader: try UUID → slug → id (covers numeric IDs too)
  useEffect(() => {
    if (!sessionLoaded) return;   // ★ DO NOT LOAD CLUB UNTIL JWT READY
    let cancelled = false;
  
    const cached = readClubCache(idParam);
    if (cached) {
      setClub(cached);
      setLoading(false);
    } else {
      setClub(null);
      setLoading(true);
    }

    const loadClub = async () => {
      setDebugParam(idParam);
      if (!idParam) return;
      setLoading((prev) => prev && !cached);
      setNotFound(false);
      setLastError(null);
      setLastTried('');
   


      // SELECT now includes avatar + name_last_changed_at

      const selectCols = `
  id, slug, name, tagline, about, location,
  banner_url, profile_image_url, name_last_changed_at,
  featured_posters,
  next_screening:club_next_screening(*)
`;



      try {
        // 1) UUID → by id
        if (UUID_RX.test(idParam)) {
          setLastTried('id (uuid)');
          const { data, error } = await supabase
            .from('clubs')
            .select(selectCols)
            .eq('id', idParam)
            .maybeSingle();

          if (cancelled) return;

          if (error) setLastError(error);
          if (data) {
            const mapped = mapClubRowToUI(data);
            if (mapped.nextEvent && !mapped.nextEvent.poster && mapped.nextEvent.title) {
              const guess = await fetchPosterFromTMDB(cleanTitleForSearch(mapped.nextEvent.title));
              mapped.nextEvent.poster = guess?.poster || fallbackNext;
            }
            try {
              const raw = localStorage.getItem(`sf_featured_map_${data.id}`);
              mapped.featuredMap = raw ? JSON.parse(raw) : {};
            } catch {}
            writeClubCache(idParam, mapped);
            setClub(mapped);
setPersistedFilmId(mapped?.nextEvent?.movieId ?? null); // ← add this
setNewName(mapped.name || '');
setLoading(false);
return;
          }
        }

        // 2) Try slug
        setLastTried((s) => (s ? `${s} → slug` : 'slug'));
        let { data, error } = await supabase
          .from('clubs')
          .select(selectCols)
          .eq('slug', idParam)
          .maybeSingle();

        if (cancelled) return;

        if (error) setLastError(error);
        if (!data && UUID_RX.test(idParam)) {
          // 3) Try id when it looks like a valid UUID
          setLastTried((s) => `${s} → id`);
          const alt = await supabase
            .from('clubs')
            .select(selectCols)
            .eq('id', idParam)
            .maybeSingle();
          data = alt.data;
          if (alt.error) setLastError(alt.error);
        }

        if (data) {
          const mapped = mapClubRowToUI(data);
          if (mapped.nextEvent && !mapped.nextEvent.poster && mapped.nextEvent.title) {
            const guess = await fetchPosterFromTMDB(cleanTitleForSearch(mapped.nextEvent.title));
            mapped.nextEvent.poster = guess?.poster || fallbackNext;
          }
          try {
            const raw = localStorage.getItem(`sf_featured_map_${data.id}`);
            mapped.featuredMap = raw ? JSON.parse(raw) : {};
          } catch {}
          writeClubCache(idParam, mapped);
          setClub(mapped);
setPersistedFilmId(mapped?.nextEvent?.movieId ?? null); // ← add this
setNewName(mapped.name || '');
setLoading(false);
return;

        }

        setNotFound(true);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setLastError({ message: e?.message || 'Unknown runtime error' });
          setNotFound(true);
          setLoading(false);
        }
      }
    };

    loadClub();
    return () => { cancelled = true; };
  }, [idParam, sessionLoaded]);





  // Load featured films from the table (new source) and hydrate the UI shape
useEffect(() => {
  let alive = true;
  (async () => {
    if (!sessionLoaded) return;
if (!club?.id) return;


    try {
      const { data: rows, error } = await supabase
        .from("club_featured_films")
        .select("tmdb_id, title, poster_path, added_at")
        .eq("club_id", club.id)
        .order("added_at", { ascending: false });

              // table might not exist yet → 404/42P01
      if (error && (error.code === "42P01" || error.message?.includes("relation") || error.status === 404)) {
        // keep using clubs.featured_posters fallback silently
        return;
      }


      if (error) throw error;
      if (!alive) return;

      // If table is empty, keep whatever is already in clubs.featured_posters
      if (!rows || rows.length === 0) return;

      // Build URLs + map that your <FeaturedFilms> expects
      const TMDB = "https://image.tmdb.org/t/p/w500";
      const urls = [];
      const map = {};

      for (const r of rows) {
        // Prefer poster_path from table; if missing, leave empty (your component can backfill via TMDB)
        const url = r?.poster_path ? `${TMDB}${r.poster_path}` : null;
        if (url) {
          urls.push(url);
          map[url] = { id: r.tmdb_id, title: r.title || null };
        }
      }

      // Only update if we actually produced URLs
      if (urls.length) {
        setClub((prev) =>
          prev
            ? {
                ...prev,
                featuredFilms: urls,
                featuredMap: map,
              }
            : prev
        );

        // cache the map like the rest of your code already does
        try {
          localStorage.setItem(`sf_featured_map_${club.id}`, JSON.stringify(map));
        } catch {}
      }
    } catch (e) {
      console.warn("[featured] load from club_featured_films failed:", e?.message || e);
    }
  })();

  return () => {
    alive = false;
  };
}, [club?.id]);

// Load Next Screening from DB into state
useEffect(() => {
  if (!sessionLoaded) return;
  if (!club?.id) return;

  let active = true;

  (async () => {
    // Try to load a single next screening row. If duplicates exist (no UNIQUE constraint on club_id),
    // order and pick the newest so the UI can still hydrate.
    const { data, error } = await supabase
      .from("club_next_screening")
      .select("*")
      .eq("club_id", club.id)
      .order("screening_at", { ascending: false, nullsLast: true })
      .order("id", { ascending: false })
      .limit(1);

    if (!active) return;

    if (error) {
      console.warn("[nextScreening] load error:", error);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row) {
      // No row — leave nextScreening null
      return;
    }

    // ⭐ Map DB row → UI shape
    if (row) {
      const normalized = normalizeTmdbPoster(row.film_poster);
      let posterUrl = normalized.url;
      // Clean up bad poster values in DB (e.g., '/test.jpg' or blob URLs)
      if (!normalized.path && row.film_poster) {
        supabase
          .from("club_next_screening")
          .update({ film_poster: null })
          .eq("id", row.id)
          .eq("club_id", club.id)
          .then(() => {
            console.info("[nextScreening] cleaned invalid film_poster", row.film_poster);
          })
          .catch((err) => console.warn("[nextScreening] cleanup failed", err));
        posterUrl = null;
      }
      // If DB poster missing, try TMDB fallback using title
      if (!posterUrl && row.film_title) {
        const guess = await fetchPosterFromTMDB(cleanTitleForSearch(row.film_title));
        posterUrl = guess?.poster || null;
        if (posterUrl) {
          const guessedPath = extractTmdbPath(posterUrl);
          if (guessedPath) {
            setPersistedPosterPath(guessedPath);
            // Persist the guessed poster so future loads don’t fall back again
            try {
              await supabase
                .from("club_next_screening")
                .update({ film_poster: guessedPath })
                .eq("id", row.id)
                .eq("club_id", club.id);
            } catch (err) {
              console.warn("[nextScreening] failed to persist guessed poster", err);
            }
          }
        }
      }
      // Last resort: use static fallback
      const finalPoster = posterUrl || fallbackNext;
      setNextScreening({
        filmId: row.film_id,
        title: row.film_title,
        poster: finalPoster,
        posterPath: normalized.path || extractTmdbPath(posterUrl),
        date: row.screening_at,
        location: row.location,
        caption: row.caption,
        id: row.id,
      });
      setPersistedFilmId(row.film_id ?? null);
      const pathToPersist = normalized.path || extractTmdbPath(posterUrl);
      if (pathToPersist) setPersistedPosterPath(pathToPersist);
    }
    

    console.log("[NEXT LOADER] loaded:", row);

    // ⭐ Mirror into club.nextEvent for UI
    setClub((prev) =>
      prev
        ? {
            ...prev,
            nextEvent: {
              ...prev.nextEvent,
              title: row.film_title,
              date: row.screening_at,
              location: row.location,
              caption: row.caption,
              poster:
                normalizeTmdbPoster(row.film_poster).url ||
                prev.nextEvent?.poster ||
                fallbackNext,
              movieId: row.film_id,
            },
          }
        : prev
    );
  })();

  return () => {
    active = false;
  };
}, [club?.id, sessionLoaded]);



  // Normalize to pretty slug when available
  useEffect(() => {
    const paramIsIdLike = clubParam && (UUID_RX.test(clubParam) || clubParam === club?.id);
    if (club?.slug && paramIsIdLike && club.slug !== clubParam) {
      navigate(`/clubs/${club.slug}`, { replace: true });
    }
  }, [club?.slug, club?.id, clubParam, navigate]);

  // Remember active club for cross-page actions (Movies → Nominate)
  useEffect(() => {
  if (club?.id) localStorage.setItem("activeClubId", club.id);
  if (club?.slug) localStorage.setItem("activeClubSlug", club.slug);
}, [club?.id, club?.slug]);

useEffect(() => {
  if (!club) return;
  if (club.slug) localStorage.setItem("activeClubSlug", club.slug);
  if (club.id)   localStorage.setItem("activeClubId", club.id);
}, [club?.slug, club?.id]);

// If we have a persisted TMDB path but the UI poster is missing or a fallback, hydrate it
useEffect(() => {
  if (!nextScreening?.posterPath) return;
  const isFallback = !nextScreening.poster || isBadPoster(nextScreening.poster) || nextScreening.poster === fallbackNext;
  if (!isFallback) return;
  const normalized = normalizeTmdbPoster(nextScreening.posterPath);
  if (normalized.url) {
    setNextScreening((prev) => ({
      ...(prev || {}),
      poster: normalized.url,
    }));
  }
}, [nextScreening?.posterPath, nextScreening?.poster]);
  
  // Hydrate members for real UUID clubs
  useEffect(() => {
    let cancelled = false;
    async function hydrateMembers() {
      if (!club?.id || !UUID_RX.test(String(club.id))) return;
      const { data: requests } = await supabase
  .from('membership_requests')
  .select('id, user_id, created_at')
  .eq('club_id', club.id)
  .eq('status', 'pending')
  .order('created_at', { ascending: true });

      try {
        const { data: rows, error } = await supabase
          .from('club_members')
          .select('user_id, role')
          .eq('club_id', club.id);
        if (cancelled) return;
        if (!error && rows?.length) {
          setClub((prev) => prev ? {
            ...prev,
            membersList: rows.map(r => ({
              id: r.user_id,
              name: r.user_id === user?.id ? (user?.name || 'You') : 'Member',
              avatar: r.user_id === user?.id ? (user?.avatar || fallbackAvatar) : fallbackAvatar,
              role: r.role || ROLE.NONE,
            })),
            members: rows.length
          } : prev);
        }
      } catch {}
    }
    hydrateMembers();
    return () => { cancelled = true; };
  }, [club?.id, user]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!club?.id) return;
      setMembersLoading(true);
      setMembersErr("");
      try {
              // 1) raw
      const { data: memRows, error: memErr } = await supabase
      .from("club_members")
      .select("user_id, role")
      .eq("club_id", club.id);
    if (memErr) throw memErr;

    // 2) profiles
    const ids = (memRows || []).map(r => r.user_id).filter(Boolean);
    let profilesMap = {};
    if (ids.length) {
      const { data: profRows, error: profErr } = await supabase
        .from("profiles")
        .select("id, slug, display_name, avatar_url")
        .in("id", ids);
      if (!profErr) {
        profilesMap = Object.fromEntries((profRows || []).map(p => [p.id, p]));
      }
    }

    const priority = { president: 0, vice_president: 1, member: 2 };
    const sorted = (memRows || []).map(r => ({
      user_id: r.user_id,
      role: r.role || "member",
      profiles: profilesMap[r.user_id] || null,
    })).sort((a, b) => {
      const pa = priority[a.role] ?? 9;
      const pb = priority[b.role] ?? 9;
      if (pa !== pb) return pa - pb;
      const an = (a.profiles?.display_name || "").toLowerCase();
      const bn = (b.profiles?.display_name || "").toLowerCase();
      return an.localeCompare(bn);
    });

    if (active) setMembers(sorted);

      } catch (e) {
        if (active) setMembersErr(e.message || String(e));
      } finally {
        if (active) setMembersLoading(false);
      }
    })();
    return () => { active = false; };
  }, [club?.id]);

  const currentUserId = user?.id || 'u_creator';

  const viewerMember = useMemo(
    () => (club?.membersList || []).find((m) => m.id === currentUserId),
    [club, currentUserId]
  );
 
  const isVice = viewerMember?.role === ROLE.VICE;
  
  const isMemberByContext =
    Array.isArray(user?.joinedClubs) && (club?.id ? user.joinedClubs.some((c) => String(c) === String(club.id)) : false);

  // Robust gate for member-only sections
// TMDB numeric ID for rating & takes





  const canEdit =
    isPresident || isVice || hasRole('admin') || hasRole('president') || hasRole('vice_president');
    // Put this AFTER hasRole/isPresident/isVice/isStaff/canEdit/isMember are defined


useEffect(() => {
  let ignore = false;
  (async () => {
    if (!club?.id || !user?.id) return;
    const { data, error } = await supabase
      .from("club_members")
      .select("user_id, role")
      .eq("club_id", club.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!ignore) {
      setIsMember(
        !!data ||
        isPresident ||
        isVice ||
        isStaff
      );
    }
  })();
  return () => { ignore = true; };
}, [club?.id, user?.id, isPresident, isVice, isStaff]);

const canSeeMembersOnly =
  !!user?.id &&
  (
    isPartner || // ← SuperFilm staff override
    canEdit ||
    isPresident ||
    isVice ||
    isStaff ||
    isMember
  );





// Update a single nextScreening + club.nextEvent field safely
const updateField = (field, value) => {
  // 1) Update nextScreening (source of truth)
  setNextScreening((prev) => ({
    ...(prev || {}),
    [field]: value,
  }));

  // 2) Mirror into club.nextEvent
  setClub((prev) =>
    prev
      ? {
          ...prev,
          nextEvent: {
            ...(prev.nextEvent || {}),
            [field]: value,
          },
        }
      : prev
  );
};

  

  // Hydrate recent activity feed for this club (uses the same view)
useEffect(() => {
  let cancelled = false;

  (async () => {
    if (!sessionLoaded) return;
if (!club?.id) {

      setClub(prev => prev ? { ...prev, activityFeed: [] } : prev);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("recent_activity_v")
        .select("id, created_at, summary, actor_name, actor_avatar")
        .eq("club_id", club.id)
        .order("created_at", { ascending: false })
        .limit(6);

      if (cancelled) return;
      if (!error) {
        // Map to the shape your UI already expects: { id, text, ts }
        const mapped = (data || []).map(r => ({
          id: r.id,
          text: r.summary || "",
          ts: new Date(r.created_at).getTime(),
        }));
        setClub(prev => prev ? { ...prev, activityFeed: mapped } : prev);
      }
    } catch {
      if (!cancelled) {
        setClub(prev => prev ? { ...prev, activityFeed: [] } : prev);
      }
    }
  })();

  return () => { cancelled = true; };
}, [club?.id, sessionLoaded]);


useEffect(() => {
  let ignore = false;
  (async () => {
    if (!club?.id || !user?.id) return;
    const { data, error } = await supabase
      .from("club_members")
      .select("user_id, role")
      .eq("club_id", club.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!ignore) {
      setIsMember(
        !!data ||
        isPresident ||
        isVice ||
        isStaff
      );
    }
  })();
  return () => { ignore = true; };
// Tip: avoid putting the function `hasRole` in deps if it isn't memoized.
}, [club?.id, user?.id, isPresident, isVice, isStaff]);
/* end paste */

// (optional) derive canSeeMembersOnly AFTER the effect and flags:



useEffect(() => {
  async function loadAvg() {
    if (!sessionLoaded) return;
    if (!club?.id || !nextFilmId) {
      setNextAvg(null);
      setNextRatingCounts([0, 0, 0, 0, 0]);
      setNextRatingTotal(0);
      return;
    }
    const { data, error } = await supabase
      .from("club_film_takes")
      .select("rating")
      .eq("club_id", club.id)
      .eq("film_id", nextFilmId);

    if (error) {
      console.warn("avg rating error:", error.message);
      setNextAvg(null);
      setNextRatingCounts([0, 0, 0, 0, 0]);
      setNextRatingTotal(0);
      return;
    }
    const values = (data || [])
      .map((r) => Number(r.rating))
      .filter((v) => Number.isFinite(v) && v > 0)
      .map((v) => (v > 5 ? v / 2 : v));
    const avg = values.length
      ? Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1))
      : null;
    const counts = [0, 0, 0, 0, 0];
    values.forEach((v) => {
      const idx = Math.min(4, Math.max(0, Math.round(v) - 1));
      counts[idx] += 1;
    });
    setNextAvg(avg);
    setNextRatingCounts(counts);
    setNextRatingTotal(values.length);
  }
  loadAvg();
}, [club?.id, nextFilmId, sessionLoaded]);



useEffect(() => {
  function onRatingsUpdated(e) {
    if (!club?.id || !nextFilmId) return;
    if (e?.detail?.clubId !== club.id) return;
    if (e?.detail?.filmId !== nextFilmId) return;

    (async () => {
      const { data } = await supabase
        .from("club_film_takes")
        .select("rating")
        .eq("club_id", club.id)
        .eq("film_id", nextFilmId);

      const values = (data || [])
        .map((r) => Number(r.rating))
        .filter((v) => Number.isFinite(v) && v > 0)
        .map((v) => (v > 5 ? v / 2 : v));
      const avg = values.length
        ? Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1))
        : null;
      const counts = [0, 0, 0, 0, 0];
      values.forEach((v) => {
        const idx = Math.min(4, Math.max(0, Math.round(v) - 1));
        counts[idx] += 1;
      });
      setNextAvg(avg);
      setNextRatingCounts(counts);
      setNextRatingTotal(values.length);
    })();
  }
  window.addEventListener("ratings-updated", onRatingsUpdated);
  window.addEventListener("club-film-takes-updated", onRatingsUpdated);
  return () => {
    window.removeEventListener("ratings-updated", onRatingsUpdated);
    window.removeEventListener("club-film-takes-updated", onRatingsUpdated);
  };
}, [club?.id, nextFilmId]);


useEffect(() => {
  let cancelled = false;

  async function check() {
    if (!user?.id || !club?.id) {
      if (!cancelled) setIsClubAdmin(false);
      if (!sessionLoaded) return;

      return;
    }

    const allowed = ["president", "vice", "admin", "moderator"];

    // 1) Try club_staff.role (singular)
    const { data: staffRow, error: staffErr } = await supabase
      .from("club_staff")
      .select("role")
      .eq("club_id", club.id)
      .eq("user_id", user.id)
      .maybeSingle();

    let ok = false;

    if (staffRow?.role) {
      ok = allowed.includes(String(staffRow.role).toLowerCase());
    } else {
      // 2) Fallback to profile_roles.roles (plural, likely an array/jsonb)
      const { data: roleRow, error: roleErr } = await supabase
        .from("profile_roles")
        .select("roles")
        .eq("club_id", club.id)
        .eq("user_id", user.id)
        .maybeSingle();

      // Normalize roles into a string array
      let rolesArr = [];
      const raw = roleRow?.roles;

      if (Array.isArray(raw)) {
        rolesArr = raw;
      } else if (raw && typeof raw === "object") {
        // jsonb object? e.g., { roles: [...] } — try common shapes
        if (Array.isArray(raw.roles)) rolesArr = raw.roles;
      } else if (typeof raw === "string") {
        // comma/space separated fallback
        rolesArr = raw.split(/[, ]+/).filter(Boolean);
      }

      ok = rolesArr.some((r) => allowed.includes(String(r).toLowerCase()));
    }

    if (!cancelled) setIsClubAdmin(ok);
  }

  check();
  return () => {
    cancelled = true;
  };
}, [club?.id, user?.id, sessionLoaded]);






const handleFeaturedSearch = async () => {
  const q = featuredSearch?.trim();
  if (!q) return;
  try {
    const hits = await searchMovies(q); // [{ id, title, year, posterUrl, backdropUrl }]
    // Map to the raw-ish shape your UI likely expects
    const items = (hits || []).map(h => ({
      id: h.id,
      title: h.title,
      poster_path: h.posterUrl ? h.posterUrl.replace(/^https:\/\/image\.tmdb\.org\/t\/p\/w\d+/, "") : null,
      backdrop_path: h.backdropUrl ? h.backdropUrl.replace(/^https:\/\/image\.tmdb\.org\/t\/p\/w\d+/, "") : null,
      release_date: h.year ? `${h.year}-01-01` : null,
      // keep full URLs too (handy for <img> without prefixing)
      posterUrl: h.posterUrl || null,
      backdropUrl: h.backdropUrl || null,
    }));
    setFeaturedResults(items);
  } catch (e) {
    console.error("Featured search failed:", e);
    setFeaturedResults([]);
  }
};

function onFeaturedKeyDown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    handleFeaturedSearch();
  }
}

  



  // persist featured posters
  const persistFeatured = async (nextArr) => {
    if (!UUID_RX.test(String(club?.id))) return; // skip if not a real UUID club
    const { error } = await supabase
      .from('clubs')
      .update({ featured_posters: nextArr })
      .eq('id', club.id);
    if (error) throw error;
  };

  const addFeaturedFilm = async (posterUrl, meta) => {
    if (!posterUrl || !meta?.id) return;
  
    // ✅ confirmation toast
    setLastAdded(meta?.title || "Film");
  
    setClub((prev) => {
      const next = [...(prev.featuredFilms || []), posterUrl];
      const nextMap = { ...(prev.featuredMap || {}) };
      if (meta?.id) nextMap[posterUrl] = { id: meta.id, title: meta.title };
  
      try {
        localStorage.setItem(`sf_featured_map_${prev.id}`, JSON.stringify(nextMap));
      } catch {}
  
      return {
        ...prev,
        featuredFilms: next,
        featuredMap: nextMap,
        activityFeed: [
          {
            id: `a_${Date.now()}`,
            type: "feature",
            text: "Added a featured film",
            ts: Date.now(),
          },
          ...(prev.activityFeed || []),
        ],
      };
    });
  
    try {
      const nextArr = [...(club?.featuredFilms || []), posterUrl];
      await persistFeatured(nextArr);
      await postActivity(`featured "${meta?.title || "a film"}"`);
      if ((club?.featuredFilms?.length || 0) === 0) setShowFeaturedTip(true);
    } catch (e) {
      // revert on error
      setClub((prev) => ({
        ...prev,
        featuredFilms: (prev.featuredFilms || []).filter((u) => u !== posterUrl),
      }));
      alert(e?.message || "Could not save featured films.");
    }
  };

  // member submits rating + blurb for the open review
  async function handleSubmitClubReview(review_id, { rating_5, blurb, aspect_key }) {
    const { data, error } = await supabase
      .from("club_review_entries")
      .upsert(
        { review_id, user_id: user.id, rating_5, blurb, aspect_key },
        { onConflict: "review_id,user_id" }
      )
      .select("*")
      .single();
  
    if (!error) {
      const { data: review } = await supabase
        .from("club_reviews")
        .select("club_id, tmdb_id, title, poster_url, year")
        .eq("id", review_id)
        .single();
  
      const current = Array.isArray(profile?.film_takes) ? profile.film_takes : [];
      const next = [
        {
          id: crypto.randomUUID(),
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          blurb,
          rating_5,
          aspect_key: aspect_key || null,
          movie: {
            id: review.tmdb_id,
            title: review.title,
            year: review.year,
            poster: review.poster_url,
          },
          club: { id: review.club_id },
          club_context: true,
        },
        ...current,
      ];
      await saveProfilePatch({ film_takes: next });
    }
    return { data, error };
  }
  
  


  
  
  



  const removeFeaturedFilm = async (index) => {
    if (!club) return;
    const prev = club.featuredFilms || [];
    if (index < 0 || index >= prev.length) return;

    const next = prev.filter((_, i) => i !== index);
    // optimistic UI
    setClub((p) => ({ ...p, featuredFilms: next }));

    try {
      await persistFeatured(next);
      await postActivity("removed a featured film");
    } catch (e) {
      // revert on error
      setClub((p) => ({ ...p, featuredFilms: prev }));
      alert(e?.message || 'Could not remove poster.');
    }
  };

  const handleImageUpload = (e, section) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setClub((prev) => {
        const updated = { ...prev };
        if (section === 'nextEvent') updated.nextEvent.poster = reader.result;
        if (section === 'banner') {
          setRawBannerImage(reader.result);
          setShowBannerCropper(true);
          return prev;
        }
        return updated;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleBannerCropComplete = async (result /* Blob or dataURL string */) => {
    try {
      if (!club?.id) return;
  
      // 1) Upload cropped result to Storage
      const path = `${club.id}/banner.jpg`;
      const publicUrl = await uploadToBucket({
        bucket: "club-avatars",           // reuse existing bucket
        path,
        file: result,
        contentType: "image/jpeg",
      });
      
  
      // 2) Persist to DB
      if (publicUrl) {
        const { error: updErr } = await supabase
          .from("clubs")
          .update({ banner_url: publicUrl })
          .eq("id", club.id);
        if (updErr) throw updErr;
  
        // 3) Update local UI (instant refresh with cache-busted URL)
        setClub((prev) => ({ ...prev, banner: publicUrl }));
        await postActivity("updated the banner image");
      }
    } catch (e) {
      alert(e?.message || "Failed to save cropped banner.");
    } finally {
      setShowBannerCropper(false);
      setRawBannerImage(null);
    }
  };
  
  const openReCrop = () => {
    if (!club?.banner) return;
    setRawBannerImage(club.banner);
    setShowBannerCropper(true);
  };

  const handlePartnerDeleteClub = async () => {
    if (!club?.id) return;
    const label = club?.name || club?.slug || "this club";
    const confirmText = window.prompt(
      `Type DELETE to permanently remove ${label}. This cannot be undone.`
    );
    if (confirmText !== "DELETE") return;
    try {
      const { error } = await supabase.from("clubs").delete().eq("id", club.id);
      if (error) throw error;
      toast.success("Club deleted.");
      navigate("/clubs", { replace: true });
    } catch (e) {
      console.warn("delete club failed", e?.message || e);
      toast.error(e?.message || "Could not delete club.");
    }
  };

  const handleToggleMembership = async () => {
    if (!club) return;
    if (!user?.id) {
      if (window.confirm('You need to sign in to join this club. Go to sign-in now?')) navigate('/auth');
      return;
    }
    const list = club.membersList || [];
    const already = list.some((m) => m.id === currentUserId);

    if (already) {
      const me = list.find((m) => m.id === currentUserId);
      const solePresident = me?.role === ROLE.PRESIDENT && !list.some((m) => m.id !== currentUserId && m.role === ROLE.PRESIDENT);
      if (solePresident) { alert('You must transfer the presidency before leaving.'); return; }
    }

    if (!UUID_RX.test(String(club.id))) {
      if (already) {
        const updated = list.filter((m) => m.id !== currentUserId);
        setClub((p) => ({ ...p, membersList: updated, members: updated.length }));
      } else {
        const optimistic = [...list, { id: currentUserId, name: user?.name || 'You', avatar: user?.avatar || fallbackAvatar, role: ROLE.NONE }];
        setClub((p) => ({ ...p, membersList: optimistic, members: optimistic.length }));
      }
      return;
    }

    if (already) {
      const prev = club.membersList;
      setClub((p) => ({ ...p, membersList: prev.filter((m) => m.id !== currentUserId), members: prev.length - 1 }));
      const { error } = await supabase.from('club_members').delete().eq('club_id', club.id).eq('user_id', currentUserId);
      if (error) {
        setClub((p) => ({ ...p, membersList: prev, members: prev.length }));
        alert(error.message || 'Could not leave the club.');
      }
    } else {
      const prev = club.membersList;
      const optimistic = [...prev, { id: currentUserId, name: user?.name || 'You', avatar: user?.avatar || fallbackAvatar, role: ROLE.NONE }];
      setClub((p) => ({ ...p, membersList: optimistic, members: optimistic.length }));
      const { error } = await supabase.from('club_members').insert([{ club_id: club.id, user_id: currentUserId, role: null }]);
      if (error) {
        setClub((p) => ({ ...p, membersList: prev, members: prev.length }));
        alert(error.message || 'Could not join the club.');
      }
    }
  };

  async function givePoints({ clubId, userId, amount, reason }) {
    const { error } = await supabase.rpc("award_points", {
      p_club: clubId,
      p_user: userId,
      p_points: amount,
      p_reason: reason || null,
    });
    if (error) throw error;
  }

  async function removeNomination(movieId) {
    if (!club?.id || !movieId) return;
    const ok = window.confirm("Remove this nomination?");
    if (!ok) return;
  
    // Optimistic UI update
    setNominations((prev) =>
      prev.filter((n) => String(n.movie_id ?? n.id) !== String(movieId))
    );
  
    try {
      const { error } = await supabase
        .from("club_nominations")
        .delete()
        .eq("club_id", club.id)
        .eq("movie_id", movieId);
      if (error) throw error;
      console.log("Nomination removed:", movieId);
    } catch (err) {
      console.warn("Failed to remove nomination:", err.message);
    }
  }

 // put with your other callbacks
const handleNextEventSearch = useCallback(async () => {
  const q = (nextSearch || "").trim();
  if (!q) {
    setNextSearchResults([]);
    return;
  }

  setTmdbBusy(true);
  try {
    // 1) Fast path via your tmdb client helper
    //    (returns { id, title, year, posterUrl, backdropUrl }[])
    const hits = await searchMovies(q).catch(() => null);
    if (Array.isArray(hits) && hits.length) {
      const mapped = hits.map(h => ({
        id: h.id,
        title: h.title || h.name,
        // normalize to TMDB-like fields the UI already expects
        poster_path: h.posterUrl
          ? h.posterUrl.replace(/^https:\/\/image\.tmdb\.org\/t\/p\/w\d+/, "")
          : null,
        backdrop_path: h.backdropUrl
          ? h.backdropUrl.replace(/^https:\/\/image\.tmdb\.org\/t\/p\/w\d+/, "")
          : null,
      }));
      setNextSearchResults(mapped);
      return;
    }

    // 2) Edge Function fallback (raw TMDB results with poster_path)
    const { data, error } = await supabase.functions.invoke("tmdb-search", {
      body: {
        path: "/search/movie",
        query: { language: "en-GB", include_adult: false, query: q },
      },
    });
    if (error) throw error;
    const raw = data?.results || data?.data?.results || [];
    setNextSearchResults(Array.isArray(raw) ? raw : []);
  } catch (err) {
    console.warn("[tmdb] edge+client failed; trying plain fetch", err);
    try {
      // 3) Plain fetch fallback to local functions route
      const res = await fetch("/functions/v1/tmdb-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/search/movie",
          query: { language: "en-GB", include_adult: false, query: q },
        }),
      });
      const d = await res.json().catch(() => ({}));
      const raw = d?.results || d?.data?.results || [];
      setNextSearchResults(Array.isArray(raw) ? raw : []);
    } catch (err2) {
      console.error("[tmdb] all fallbacks failed", err2);
      setNextSearchResults([]);
    }
  } finally {
    // ✅ always clear the busy flag (bug fix)
    setTmdbBusy(false);
  }
}, [nextSearch, supabase]);

  

  


  

  

  

    

  // NEW: avatar uploader (presidents only)
  const handleAvatarUpload = async (file) => {
    try {
      if (!file || !club?.id) return;
      if (!UUID_RX.test(String(club.id))) {
        // Demo/local: just preview
        const reader = new FileReader();
        reader.onloadend = () => setClub((p) => ({ ...p, profileImageUrl: reader.result }));
        reader.readAsDataURL(file);
        return;
      }

      setUploadingAvatar(true);
      setRenameError('');
      setRenameOk('');

      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${club.id}/avatar.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('club-avatars')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from('club-avatars').getPublicUrl(path);
      const publicUrl = data?.publicUrl;

      const { error: updErr } = await supabase
        .from('clubs')
        .update({ profile_image_url: publicUrl })
        .eq('id', club.id);
      if (updErr) throw updErr;

      setClub((p) => ({ ...p, profileImageUrl: `${publicUrl}?t=${Date.now()}` }));
      setRenameOk('Club picture updated.');
      await postActivity("updated the club picture")
    } catch (err) {
      setRenameError(err?.message || 'Failed to upload avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarCropComplete = async (result /* Blob or dataURL */) => {
    try {
      if (!club?.id) return;
  
      // 1) Upload cropped avatar
      const path = `${club.id}/avatar.jpg`;
      const publicUrl = await uploadToBucket({
        bucket: "club-avatars",        // you already use this bucket
        path,
        file: result,
        contentType: "image/jpeg",
      });
  
      // 2) Update DB
      if (publicUrl) {
        const { error: updErr } = await supabase
          .from("clubs")
          .update({ profile_image_url: publicUrl })
          .eq("id", club.id);
        if (updErr) throw updErr;
  
        // 3) Local UI
        setClub((p) => ({ ...p, profileImageUrl: publicUrl }));
        setRenameOk("Club picture updated.");
        await postActivity("updated the club picture");
      }
    } catch (err) {
      setRenameError(err?.message || "Failed to save cropped avatar.");
    } finally {
      setShowAvatarCropper(false);
      setRawAvatarImage(null);
    }
  };
  

  

  // NEW: rename handler (trigger enforces 90-day cooldown)
  const handleRenameClub = async () => {
    try {
      if (!isPresident) return;
      if (!newName || newName === club?.name) return;
      setRenameError('');
      setRenameOk('');

      if (!UUID_RX.test(String(club.id))) {
        // local demo fallback
      setClub((p) => ({ ...p, name: newName }));
      setRenameOk('Club name updated (local).');
      toast.success("Club name updated.");
      try {
        localStorage.removeItem(`sf.club.nameDraft:${club.id}`);
      } catch {}
      return;
    }

      const { error } = await supabase
        .from('clubs')
        .update({ name: newName })
        .eq('id', club.id);

      if (error) throw error;

      setClub((p) => ({ ...p, name: newName, nameLastChangedAt: new Date().toISOString() }));
      setRenameOk('Club name updated.');
      toast.success("Club name updated.");
      try {
        localStorage.removeItem(`sf.club.nameDraft:${club.id}`);
      } catch {}
      await postActivity(`renamed the club to "${newName}"`);
    } catch (err) {
      setRenameError(
        err?.message?.includes('90 days')
          ? err.message
          : (err?.message || 'Unable to rename right now.')
      );
      toast.error(err?.message || "Could not update club name.");
    }
  };

  

  // Log a row in recent_activity (leaders only by RLS)
const postActivity = async (summary) => {
  if (!club?.id || !user?.id) return;
  try {
    await supabase.from("recent_activity").insert({
      club_id: club.id,
      summary,
      actor_id: user.id,
      actor_name: user.user_metadata?.name || "Leader",
      actor_avatar: user.user_metadata?.avatar_url || null,
    });
  } catch (e) {
    console.warn("activity insert failed", e.message);
  }
};

   




  /* -----------------------------
       Render
    ------------------------------*/
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <p className="text-zinc-300">Loading club…</p>
      </div>
    );
  }
  
  if (notFound || !club) {
    return (
      <div className="min-h-screen bg-black text-white p-6 space-y-3">
        <p className="text-red-400">Club not found.</p>
        <p className="text-zinc-400 text-sm">
          Tip: ensure your route uses <code>/clubs/:clubParam</code> (or legacy <code>/club/:id</code>) and that you’re navigating with <code>{`/clubs/${'{club.slug || club.id}'}`}</code>.
        </p>
  
        {/* Debug panel */}
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">
          <div><span className="text-zinc-500">Route param:</span> <code>{debugParam || '(empty)'}</code></div>
          <div><span className="text-zinc-500">Lookup order tried:</span> <code>{lastTried || '(none)'}</code></div>
          {lastError && (
            <div className="mt-1">
              <span className="text-zinc-500">Supabase error:</span>{' '}
              <code>{(lastError.code ? `${lastError.code} - ` : '') + (lastError.message || JSON.stringify(lastError))}</code>
            </div>
          )}
          <div className="mt-2 text-zinc-400">
            Quick DB check (Supabase SQL):
            <pre className="mt-1 whitespace-pre-wrap">
  {`select id, slug, name from public.clubs
  where slug = '${debugParam.replace(/'/g, "''")}'
     or id::text = '${debugParam.replace(/'/g, "''")}'
  limit 5;`}
            </pre>
          </div>
        </div>
      </div>
    );
  }
  


  // Countdown
  const countdown = nextScreening?.date ? getCountdown(nextScreening.date) : null;
  // --- derived variables for Film Takes component (safe and correct)


  
  // Compute next allowed rename date (client hint only)
  const nextRenameDate = club?.nameLastChangedAt
    ? new Date(new Date(club.nameLastChangedAt).getTime() + 90 * 24 * 60 * 60 * 1000)
    : null;
  
  return (
      <div className="min-h-screen bg-black text-white">
{/* Banner */}
{isMounted && (
  <div
    className="h-[276px] bg-cover bg-center flex items-end px-6 py-4 relative rounded-2xl border-8 border-zinc-900 overflow-visible"
    style={{ backgroundImage: `url(${safeImageSrc(club.banner, fallbackBanner)})` }}
    aria-label={`${club.name} banner`}
  >
    {/* Legibility gradient overlays */}
    <div
      className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent"
      aria-hidden="true"
    />
    <div
      className="absolute inset-0 bg-gradient-to-r from-black/35 via-transparent to-black/35"
      aria-hidden="true"
    />

    {/* LEFT: avatar + name */}
    <div className="relative z-10 flex items-end gap-4">
      <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-zinc-800 bg-zinc-900">
        <img
            src={safeImageSrc(club.profileImageUrl || fallbackAvatar, fallbackAvatar)}
          alt={`${club.name} avatar`}
          className="h-full w-full object-cover"
        />
        {isEditing && isPresident && (
          <label className="absolute bottom-0 right-0 mb-1 mr-1 inline-flex items-center justify-center rounded-full bg-black/70 hover:bg-black/90 w-8 h-8 cursor-pointer ring-1 ring-zinc-700">
            <ImagePlus className="w-4 h-4" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onloadend = () => {
                  setRawAvatarImage(reader.result);
                  setShowAvatarCropper(true);
                };
                reader.readAsDataURL(f);
                e.currentTarget.value = "";
              }}
            />
          </label>
        )}
      </div>

      <div className="pb-1">
        {isEditing && isPresident ? (
          <div className="flex flex-col">
            <input
              className="bg-transparent border-b border-neutral-600 focus:outline-none text-3xl font-bold"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={80}
              placeholder="Club name"
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={handleRenameClub}
                className="px-3 py-1 rounded bg-yellow-500 text-black text-sm hover:bg-yellow-400"
                disabled={uploadingAvatar}
              >
                Save name
              </button>
              <span className="inline-flex items-center gap-1 text-xs opacity-70">
                <Shield size={14} /> Presidents only
              </span>
            </div>
            {!!renameError && (
              <span className="text-red-400 text-xs mt-1">{renameError}</span>
            )}
            {!!renameOk && (
              <span className="text-green-400 text-xs mt-1">{renameOk}</span>
            )}
            {nextRenameDate && (
              <div className="text-xs opacity-70 mt-1">
                Next rename after: {nextRenameDate.toLocaleDateString()}
              </div>
            )}
          </div>
        ) : (
          <h1 className="text-3xl font-bold">{club.name}</h1>
        )}
      </div>
    </div>

    {/* RIGHT: banner controls */}
    <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
      {canEdit && isEditing && (
        <>
          {/* Upload banner */}
          <label
            className="inline-flex items-center justify-center rounded-full bg-black/60 hover:bg-black/80 p-2 ring-1 ring-white/10 cursor-pointer"
            aria-label="Upload new banner image"
          >
            <ImagePlus size={18} />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleImageUpload(e, "banner")}
              className="hidden"
            />
          </label>

          {/* Re-crop banner */}
          <button
            onClick={openReCrop}
            title="Re-crop banner"
            type="button"
            className="rounded-full bg-black/60 hover:bg-black/80 p-2 ring-1 ring-white/10"
            aria-label="Re-crop banner"
          >
            <CropIcon size={18} />
          </button>
        </>
      )}

      {/* Edit toggle */}
      {canEdit && (
        <button
          onClick={async () => {
            if (isEditing) {
            }
            setIsEditing((prev) => !prev);
          }}
          className="bg-zinc-800 px-3 py-1 rounded text-sm hover:bg-zinc-700"
          type="button"
        >
          {isEditing ? "Finish Editing" : "Edit"}
        </button>
      )}
    </div>
  </div>
)}
{/* end banner */}

    
       {/* Notice Board — now global, under the banner */}
<div className="mt-6">
  {showLazy && (
    <Suspense fallback={<div className="text-xs text-zinc-500 px-6">Loading board…</div>}>
      <ClubNoticeBoard clubId={club.id} />
    </Suspense>
  )}
</div>

{/* Partner-only moderation UI; old PointsReviewPanel is deprecated */}

        {isClubAdmin && (
          <Link
            to={`/clubs/${club.slug || club.id}/requests`}
            className="text-sm text-yellow-400 hover:underline"
          >
            Requests
          </Link>
        )}
    
{/* Partner-only moderation UI; old PointsReviewPanel.jsx is now a no-op */}
{isPartner && (
  <div className="mx-6 mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10">
    <button
      type="button"
      onClick={() => setPartnerToolsOpen((v) => !v)}
      className="w-full flex items-center justify-between px-4 py-3 text-amber-50 font-semibold"
    >
      <span>Partner / Safety tools</span>
      <span className="text-xs">{partnerToolsOpen ? "Hide" : "Show"}</span>
    </button>
    {partnerToolsOpen && (
      <div className="px-4 pb-4 space-y-3">
        {showLazy ? (
          <Suspense fallback={<div className="text-xs text-amber-100/80">Loading tools…</div>}>
            <PartnerPointsReviewPanel clubId={club.id} />
          </Suspense>
        ) : null}

        {showLazy ? (
          <Suspense fallback={null}>
            <PartnerChatAuditPanel clubId={club.id} />
          </Suspense>
        ) : null}

        <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 border border-amber-400/40 px-3 py-1 text-xs text-amber-100">
          <span className="w-2 h-2 rounded-full bg-amber-300" aria-hidden />
          Signed in as SuperFilm Partner
        </div>

        <button
          type="button"
          onClick={handlePartnerDeleteClub}
          className="w-full rounded-lg border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/20"
        >
          Permanently delete this club
        </button>
      </div>
    )}
  </div>
)}
        {/* DEBUG — remove after confirming */}
        <div className="mt-2 text-[11px] text-zinc-400 px-6">
          staff: {String(isStaff)} • clubId: {club?.id || "—"}
        </div>

 
    
        {/* Transparency: recent point awards */}
<div className="mt-4 px-6">
  {showLazy && (
    <Suspense fallback={<div className="text-xs text-zinc-500">Loading awards…</div>}>
      {isPartner ? <RecentPointAwards clubId={club.id} /> : null}
    </Suspense>
  )}
</div>

    
        {/* Banner cropper modal */}
        {showBannerCropper && rawBannerImage && (
          <BannerCropper
            imageSrc={rawBannerImage}
            aspect={CLUB_BANNER_ASPECT}
            onCancel={() => {
              setShowBannerCropper(false);
              setRawBannerImage(null);
            }}
            onCropComplete={handleBannerCropComplete}
          />
        )}


{showAvatarCropper && rawAvatarImage && (
  <AvatarCropper
    imageSrc={rawAvatarImage}
    aspect={1}
    onCancel={() => {
      setShowAvatarCropper(false);
      setRawAvatarImage(null);
    }}
    onCropComplete={handleAvatarCropComplete}
  />
)}

    
        {countdown && (
          <div
            className={`${
              countdown.isUrgent ? "bg-red-600" : "bg-yellow-500"
            } mt-4 mx-6 px-4 py-2 rounded-lg w-fit font-mono text-sm text-black`}
            aria-live="polite"
          >
            {countdown.days}d {countdown.hours}h {countdown.minutes}m until screening
          </div>
        )}
    
   {/* Members */}
<div className="mt-2 pl-5 md:pl-6">
  <h3 className="text-sm font-semibold text-yellow-400 mb-2">Members</h3>

  {membersLoading ? (
    <div className="flex gap-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-10 w-10 rounded-full bg-white/10 animate-pulse" />
      ))}
    </div>
  ) : (() => {
    // Normalize incoming rows (supports shapes like { profiles: {...}, role } or flat fields)
    const normalize = (m, idx) => {
      const p = m?.profiles ?? m ?? {};
      const id = p?.id ?? m?.user_id ?? `m-${idx}`;
      const slug = p?.slug ?? m?.slug ?? null;
      const displayName = p?.display_name ?? m?.display_name ?? null;
      const avatar = p?.avatar_url ?? m?.avatar_url ?? "/avatar_placeholder.png";
      const role = m?.role ?? m?.member_role ?? p?.role ?? null;

      // premium flag from profile row
      const isPremium =
        (p?.plan && String(p.plan).toLowerCase() === "directors_cut") ||
        p?.is_premium === true ||
        (m?.plan && String(m.plan).toLowerCase() === "directors_cut") ||
        m?.is_premium === true;

      return { id, slug, displayName, avatar, role, isPremium };
    };

    // start with DB list if present
    const base = Array.isArray(members) ? members : [];
    const list = base.map(normalize);

    // ensure YOU appear if you have rights even if DB didn't return you yet
    const youId = user?.id || null;
    const youAlready = youId && list.some((x) => x.id === youId);
    const youCanForceShow =
      !!youId &&
      (canEdit ||
        isPresident ||
        isVice ||
        isStaff);

    if (!youAlready && youCanForceShow) {
      list.unshift({
        id: youId,
        slug: profile?.slug || null,
        displayName: profile?.display_name || null,
        avatar: profile?.avatar_url || "/avatar_placeholder.png",
        role: isPresident
          ? "president"
          : isVice
          ? "vice_president"
          : "member",
        isPremium:
          (profile?.plan && String(profile.plan).toLowerCase() === "directors_cut") ||
          profile?.is_premium === true,
      });
    }

    if (list.length === 0) {
      return <div className="text-sm text-zinc-500">No members yet.</div>;
    }

    return (
      <div className="flex flex-wrap gap-4">
        {list.map((m, i) => {
          const href = m.slug ? `/u/${m.slug}` : m.id ? `/profile/${m.id}` : "#";
          let roleLabel = null;
          if (m.role === "president") roleLabel = "President";
          if (m.role === "vice_president") roleLabel = "Vice President";
          if (m.role === "partner") roleLabel = "SuperFilm Partner";


          return (
            <div key={m.id ?? `member-${i}`} className="flex flex-col items-center w-20">
              <Link
                to={href}
                aria-label={roleLabel || "Member"}
                className="block h-12 w-12 rounded-full overflow-hidden ring-2 ring-yellow-400/70 hover:ring-yellow-300 focus:ring-yellow-300 transition transform duration-150 hover:scale-105 focus-visible:scale-105 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
              >
                <img
  src={safeImageSrc(m.avatar || "/avatar_placeholder.png", "/avatar_placeholder.png")}
  alt={roleLabel || "Member"}
  className="h-full w-full object-cover"
  loading="lazy"
  onError={(e) => {
    e.currentTarget.onerror = null;
    e.currentTarget.src = "/avatar_placeholder.png";
  }}
/>
                
              </Link>

              {/* username + premium badge (inline, text-only) */}
              <div className="mt-1 flex items-center gap-1 max-w-[5rem]">
                <Link
                  to={href}
                  className="text-[10px] text-zinc-300 truncate hover:underline"
                  title={m.slug ? `@${m.slug}` : m.displayName || "Member"}
                >
                  {m.slug ? `@${m.slug}` : (m.displayName || "Member")}
                </Link>
                {m.isPremium && <DirectorsCutBadge className="ml-0" size="xs" />}
              </div>

              {roleLabel && (
                <span className="mt-0.5 text-[10px] text-yellow-400 text-center">
                  {roleLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  })()}
</div>

    

{/* =========================
   Next Screening (heading + two-column grid)
========================= */}
<div className="p-6">
  {/* Heading OUTSIDE the grid so both columns align at the image top */}
  <h2 className="text-lg font-bold text-yellow-400 flex items-center mb-2">
    <Film className="w-5 h-5 mr-2" /> Next Screening
  </h2>

  <div className="grid md:grid-cols-2 gap-6 items-start">
    {/* Left: Poster */}
    <div>
    {isMounted && (
  <div
    key={nextScreening?.poster || "next-poster"}
    className="inline-block rounded-xl border-[4px] border-yellow-500 overflow-hidden group"
  >
    <Link
      to={nextScreening?.filmId ? `/movies/${nextScreening.filmId}` : "#"}
      onClick={(e) => {
        if (!nextScreening?.filmId) e.preventDefault();
      }}      
      className="block transition-transform duration-150 group-hover:scale-[1.03]"
      title={nextScreening?.movieTitle || "Open movie details"}
    >
      <img
        ref={posterRef}
        src={safeImageSrc(nextScreening?.poster || fallbackNext, fallbackNext)}
        alt={nextScreening?.movieTitle || "Next screening poster"}
        className="block w-full h-auto object-cover"
        loading="lazy"
      />
    </Link>
  </div>
)}


      {/* Edit UI (search) */}
      {canEdit && isEditing && (
        <div className="mt-2">
          <input
            value={nextSearch}
            onChange={(e) => setNextSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleNextEventSearch(); }}
            className="bg-zinc-800 p-1 rounded w-full"
            placeholder="Search film title..."
            aria-label="Search film title"
          />
          <button
            onClick={handleNextEventSearch}
            disabled={tmdbBusy}
            className="bg-yellow-500 text-black px-2 py-1 mt-1 rounded disabled:opacity-60"
          >
            {tmdbBusy ? "Searching…" : "Search"}
          </button>

          <div className="grid grid-cols-2 gap-2 mt-2">
          {nextSearchResults.map((movie) => (
              <TmdbImage
                key={movie.id}
                src={
                  movie.poster_path
                    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                    : movie.posterUrl || movie.backdropUrl || fallbackNext
                }
                alt={`${movie.title || "Film"} poster`}
                className="cursor-pointer hover:opacity-80"
                onClick={() => {
                  const pickedTitle = movie.title || movie.name || "";
                  const pickedPosterPath =
                    movie.poster_path ||
                    extractTmdbPath(movie.posterUrl) ||
                    extractTmdbPath(movie.backdropUrl) ||
                    null;
                  const fullPoster = pickedPosterPath
                    ? `https://image.tmdb.org/t/p/w500${pickedPosterPath}`
                    : movie.posterUrl || movie.backdropUrl || null;

                  // ✅ Update dedicated nextScreening state (source of truth)
                  setNextScreening((prev) => ({
                    ...(prev || {}),
                    filmId: movie.id,
                    title: pickedTitle,
                    poster: fullPoster,
                    posterPath: pickedPosterPath,
                  }));

                  
                  
                  
    

                  setNextSearchResults([]);
                }}
              />
            ))}

          </div>
        </div>
      )}
    </div>

    {/* Right: Details / Ticket */}
    <div className="h-full flex flex-col self-stretch">
      {isEditing && canEdit ? (
        <div className="space-y-3">
          {/* Title */}
          <label className="block text-xs uppercase tracking-wide text-zinc-400">Title</label>
          <input
  value={nextScreening?.title || ""}
  onChange={(e) =>
    setNextScreening((prev) => ({
      ...(prev || {}),
      title: e.target.value
    }))
  }
  className="w-full bg-zinc-800 p-2 rounded"
  placeholder="Film title"
  aria-label="Event title"
/>


          {/* Location */}
          <label className="block text-xs uppercase tracking-wide text-zinc-400">Location</label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-yellow-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
  value={nextScreening?.location || ""}
  onChange={(e) =>
    setNextScreening((prev) => ({
      ...(prev || {}),
      location: e.target.value
    }))
  }
  className="w-full bg-zinc-800 p-2 pl-9 rounded"
  placeholder="Venue, area (e.g., Electric Cinema, Notting Hill)"
  aria-label="Event location"
/>


          </div>

          {/* Tagline */}
          <label className="block text-xs uppercase tracking-wide text-zinc-400">Tagline</label>
          <textarea
  value={nextScreening?.caption || ""}
  onChange={(e) =>
    setNextScreening((prev) => ({
      ...(prev || {}),
      caption: e.target.value
    }))
  }
  className="w-full bg-zinc-800 p-2 rounded"
  placeholder="Optional note for the ticket"
  aria-label="Event caption"
/>



          {/* Date & time */}
          <label className="block text-xs uppercase tracking-wide text-zinc-400">Date &amp; time</label>
          <Suspense fallback={<div className="text-xs text-zinc-500">Date picker…</div>}>
          <DatePicker
  selected={nextScreening?.date ? new Date(nextScreening.date) : null}
  onChange={(date) => {
    if (!date) {
      setNextScreening((prev) => ({ ...(prev || {}), date: null }));
      return;
    }
    setNextScreening((prev) => ({
      ...(prev || {}),
      date: date.toISOString(),
    }));
  }}

  showTimeSelect
  dateFormat="Pp"
          className="bg-zinc-800 text-white p-2 rounded w-full"
/>


</Suspense>

          <div className="mt-3 text-xs text-zinc-400">
            Want to list a public event? Use the Events page (Discover → Events) to create it so everyone can find it.
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={saveNextScreening}
              disabled={savingNext}
              className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-400 disabled:opacity-50"
            >
              {savingNext ? "Saving…" : "Save next screening"}
            </button>
          </div>
        </div>

      ) : canSeeMembersOnly ? (
        <TicketCard
  title={nextScreening?.title}
  tagline={nextScreening?.caption}
  location={nextScreening?.location}
  datetime={
    nextScreening?.date
      ? new Date(nextScreening.date).toLocaleString([], {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : ""
  }

          onClick={() => {
            navigate(`/clubs/${club.slug || club.id}/events/next`, {
              state: { clubName: club.name, event: nextScreening, clubId: club.id },
            });
          }}
        />
      ) : (
        <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4 text-sm text-zinc-400">
          Next screening details are for members only.
          <div className="mt-3">
            {!user?.id ? (
              <button
                onClick={() => navigate("/auth")}
                className="px-3 py-1.5 rounded bg-yellow-500 text-black text-sm font-semibold hover:bg-yellow-400"
              >
                Sign in to request access
              </button>
            ) : (
              <JoinClubButton club={club} user={user} isMember={isMember} />
            )}
          </div>
        </div>
      )}

      {/* Chat teaser (members only) */}
      <div ref={teaserWrapRef} className="mt-6 hidden md:block">
        {canSeeMembersOnly ? (
          <div
            className="rounded-2xl border border-zinc-800 bg-black/50 overflow-hidden"
            style={teaserHeight ? { height: teaserHeight } : undefined}
          >
            <ClubChatTeaserCard clubId={club.id} slug={club.slug} />
          </div>
        ) : (
          <div className="rounded-xl bg-white/5 ring-1 ring-white/10 p-4 text-sm text-zinc-400">
            Club chat is for members only.
          </div>
        )}
      </div>

     

      {/* Quick personal take (posts to profiles.film_takes) */}

      {/* Film Takes */}
      <div className="mt-5 rounded-2xl border border-zinc-800 bg-gradient-to-br from-black/55 via-zinc-900/55 to-black/60 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/80 backdrop-blur-sm bg-black/40">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-yellow-300/80">
              Film Takes
            </p>
            <h3 className="text-sm font-semibold text-white">Share your club’s reactions</h3>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/clubs/${club.slug || club.id}/takes/archive`}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-zinc-200 hover:border-yellow-400 hover:text-white transition"
            >
              Archived takes
            </Link>
            <ClubAddTake
              movie={{
                id: nextScreening?.filmId,
                title: nextScreening?.title,
                poster: nextScreening?.poster,
              }}
              club={{ id: club.id, name: club.name, slug: club.slug }}
            />
          </div>
        </div>

        <div className="p-4">
          {!nextScreening?.filmId ? (
            <div className="rounded-xl border border-dashed border-zinc-700/80 bg-zinc-900/50 px-4 py-5 text-sm text-zinc-300 flex items-center justify-between gap-3 flex-wrap">
              <div>
                {canSeeMembersOnly ? (
                  canEdit ? (
                    "No film selected for this screening."
                  ) : (
                    "A film hasn’t been chosen yet. Once the club sets the next film, members’ takes will appear here."
                  )
                ) : (
                  "Film Takes are for members."
                )}
              </div>
              {canSeeMembersOnly && canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    document.querySelector('input[aria-label=\"Search film title\"]')?.focus();
                  }}
                  className="rounded-full bg-yellow-400/90 hover:bg-yellow-300 px-4 py-2 text-sm font-semibold text-black focus:outline-none focus:ring-2 focus:ring-yellow-400/70"
                >
                  Pick a film
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-black/40 p-3">
              <ClubFilmTakesSection
                clubId={club.id}
                filmId={nextScreening?.filmId}
                canSeeMembersOnly={canSeeMembersOnly}
                userId={user?.id}
              />
            </div>
          )}
        </div>
      </div>
      

   {/* Average rating graphic */}
{nextFilmId ? (
  <div className="mt-4 flex-1">
    <FilmAverageCell
      average={nextAvg}
      counts={nextRatingCounts}
      total={nextRatingTotal}
    />
  </div>
) : null}





  



</div>
</div>
</div>



{/* About + Featured (Option 1 layout) */}
<div className="px-6 mt-6 grid md:grid-cols-2 gap-6 items-start">
  <ClubAboutCard
    club={club}
    isEditing={isEditing}
    canEdit={canEdit}
    onSaved={(patch) => setClub((p)=> p ? { ...p, ...patch } : p)}
  />
  {showLazy && (
    <Suspense fallback={<div className="text-xs text-zinc-500">Loading featured films…</div>}>
      <FeaturedFilms
        club={club}
        canEdit={canEdit}
        showSearch={isEditing && canEdit}
        onChange={(next) => setClub((p)=> p ? { ...p, featuredFilms: next } : p)}
      />
    </Suspense>
  )}
</div>


{/* Nominations full-width band */}
{/* Nominations full-width band */}
{showLazy && (
  <Suspense fallback={null}>
    <NominationsCarousel
      clubId={club.id}
      canEdit={canEdit}
      isEditing={isEditing}
      nominations={nominations}
      onRemove={removeNomination}
    />
  </Suspense>
)}




<div className="mt-6">
  {showLazy && (
    <Suspense fallback={<div className="text-xs text-zinc-500 px-6">Loading year in review…</div>}>
      <ClubYearInReview clubId={club.id} />
    </Suspense>
  )}
</div>

{/* Full Members Dialog */}
{showMembersDialog && (
  <MembersDialog
    onClose={() => setShowMembersDialog(false)}
    members={members}
    memberSearch={memberSearch}
    setMemberSearch={setMemberSearch}
    isPresident={isPresident}
    hasRole={hasRole}
    user={user}
    setMemberRole={setMemberRole}
    transferPresidency={transferPresidency}
  />
)}

</div>

);
}
