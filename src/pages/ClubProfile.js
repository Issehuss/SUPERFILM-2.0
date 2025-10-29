// src/pages/ClubProfile.jsx — avatar upload + 90‑day rename (presidents only)
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  MapPin,
  Film,
  Star,
  ImagePlus,
  Crop as CropIcon,
  CalendarClock,
  Trash2,
  Shield,
} from 'lucide-react';

import { useUser } from '../context/UserContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import BannerCropper from '../components/BannerCropper';

import supabase from '../supabaseClient.js';
import NominationsPanel from "../components/NominationsPanel";
import ClubChatTeaserCard from "../components/ClubChatTeaserCard";
import uploadAvatar from "../lib/uploadAvatar";
import ClubNoticeBoard from "../components/ClubNoticeBoard";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import RoleBadge from "../components/RoleBadge.jsx";
import { toast } from "react-hot-toast";
import AssignRoleMenu from "../components/AssignRoleMenu.jsx";
import JoinClubButton from "../components/JoinClubButton";
import ClubYearInReview from "../components/ClubYearInReview.jsx";
import { Info } from "lucide-react";
import PointsReviewPanel from "../components/PointsReviewPanel.jsx";
import useStaff from "../hooks/useStaff";
import AttendButton from "../components/AttendButton.jsx";
import FilmAverageCell from "../components/FilmAverageCell.jsx";
import RecentPointAwards from "../components/RecentPointAwards.jsx";
import { MoreHorizontal, LogOut } from "lucide-react";
import { searchMovies } from "../lib/tmdbClient";
import AspectPicker from "../components/AspectPicker";
import { ASPECTS } from "../constants/aspects";
import ClubFilmTakesSection from "../components/ClubFilmTakesSection.jsx";
import NominationsCarousel from "../components/NominationsCarousel.jsx";
// at top with other imports



import FeaturedFilms from "../components/FeaturedFilms.jsx";
import ClubAboutCard from "../components/ClubAboutCard.jsx";

import DirectorsCutBadge from "../components/DirectorsCutBadge";






















// UUID detector
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;





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
const fallbackAvatar = '/avatars/default.jpg';



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
  return {
    id: row.id,
    slug: row.slug || null,
    name: row.name,
    tagline: row.tagline || '',
    about: row.about || '',
    location: row.location || '',
    banner: row.banner_url || fallbackBanner,
    profileImageUrl: row.profile_image_url || '',
    nameLastChangedAt: row.name_last_changed_at || null,
    nextEvent: {
      title: row.next_screening_title || 'Screening',
      date: row.next_screening_at || new Date(Date.now() + 7 * 86400000).toISOString(),
      location: row.next_screening_location || row.location || '',
      caption: row.next_screening_caption || '',
      poster: row.next_screening_poster || fallbackNext,
      movieId: row.next_screening_tmdb_id || null,   // ← add this
      attendingCount: Number(row?.attending_count) || 0,
      location: row.location || '',
      primeLocation: row.prime_location || row.location || '',
      genreFocus: Array.isArray(row.genre_focus) ? row.genre_focus : [],
      meetingSchedule: row.meeting_schedule || '',
    },
    
    featuredFilms: Array.isArray(row.featured_posters) ? row.featured_posters : [],
    featuredMap: {}, // posterUrl -> { id, title }
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
              const avatar = p.avatar_url || "/avatar_placeholder.png";
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
                      e.currentTarget.src = "/avatar_placeholder.png";
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
                      {role === "editor_in_chief" && (
                        <span className="w-3 h-3 rounded-full bg-blue-400 inline-block" title="Editor in Chief" />
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

                      {role === "editor_in_chief" ? (
                        <button
                          onClick={() => setMemberRole(p.id, "member")}
                          className="text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
                        >
                          Remove EIC
                        </button>
                      ) : (
                        <button
                          onClick={() => setMemberRole(p.id, "editor_in_chief")}
                          className="text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
                        >
                          Make EIC
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



  // --- put this ABOVE `export default function ClubProfile()` ---


// ⬇️ put this ABOVE `export default function ClubProfile()`
function LeaveClubMenu({ clubId, isMember, onLeft }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [coords, setCoords] = useState({ top: 0, right: 0 });
  const btnRef = useRef(null);

  async function leave() {
    const ok = typeof window !== "undefined"
      ? window.confirm("Are you sure you want to leave this club?")
      : true;
    if (!ok) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("leave_club", { p_club: clubId });
      if (error) throw error;
      if (data?.ok) {
        if (data.code === "NEED_VP") {
          alert("Appoint a Vice President before leaving.");
        } else if (data.code === "ONLY_MEMBER") {
          alert("Club needs at least one member. Contact a company partner to archive.");
        } else {
          onLeft?.();
        }
      } else {
        alert(data?.message || "Could not leave.");
      }
    } catch (e) {
      alert(e.message || "Could not leave.");
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  function toggleMenu() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  }

  // ✅ hooks are never conditional
  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (btnRef.current && btnRef.current.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  
  // Guard AFTER hooks so order never changes
  if (!isMember) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggleMenu}
        className="rounded-full bg-zinc-800 w-9 h-9 flex items-center justify-center hover:bg-zinc-700"
        aria-label="More actions"
      >
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <div
          className="fixed z-[100] w-44 rounded-xl bg-black/95 ring-1 ring-white/10 shadow-2xl py-1"
          style={{ top: coords.top, right: coords.right }}
        >
          <button
            onClick={leave}
            disabled={busy}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 text-left"
          >
            <LogOut size={16} /> Leave club
          </button>
        </div>
      )}
    </>
  );
}

  

function useFilmTakes() {
  const { user, profile, saveProfilePatch } = useUser();

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
      movie: movie ? {
        id: movie.id ?? null,
        title: movie.title ?? movie.name ?? null,
        year: movie.year ?? null,
        poster: movie.poster ?? null,
      } : null,
      club: club ? { id: club.id ?? null, name: club.name ?? null, slug: club.slug ?? null } : null,
      club_context: !!club,
    };

    const next = [payload, ...current];
    await saveProfilePatch({ film_takes: next });
    return next;
  }

  return { addTake };
}




// ...

function ClubAddTake({ movie, club }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [rating, setRating] = useState(null); // half-steps via input below
  const [aspect, setAspect] = useState(null); // key from ASPECTS
  const [busy, setBusy] = useState(false);
  const { user } = useUser();
  const { addTake } = useFilmTakes();
  

  if (!user) return null;

  async function save() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      // 1) Keep your existing profile.film_takes update
      await addTake({
        text,
        rating_5: typeof rating === "number" ? rating : null,
        aspect_key: aspect || null,
        movie,
        club,
      });
  
      // 2) Also persist to club_film_takes (one active take per user+film+club)
      if (!movie?.id || !club?.id) {
        // silently skip if missing context
        console.warn("[ClubAddTake] missing movie.id or club.id — skipping club_film_takes upsert");
      } else {
        const payload = {
          club_id: club.id,
          user_id: user.id,
          film_id: movie.id,
          screening_id: null, // <- if you track specific screenings, set the id here
          film_title: movie.title ?? null,
          poster_path: movie.poster ?? null,
          rating: rating != null ? Number((Number(rating) * 2).toFixed(1)) : null, // convert 0.5–5.0 → 0–10 scale, optional
          take: text.trim(),
          is_archived: false,
        };
  
        const { error: takeErr } = await supabase
          .from("club_film_takes")
          .upsert(payload, {
            onConflict: "club_id,user_id,film_id",
            ignoreDuplicates: false,
          })
          .select("*");
  
        if (takeErr) {
          console.warn("[club_film_takes upsert] failed:", takeErr.message);
          // do not throw; we already saved to profile.film_takes, and UI should not break
        } else {
          // optional: notify listeners to refresh spotlight/section
          window.dispatchEvent(
            new CustomEvent("club-film-takes-updated", {
              detail: { clubId: club.id, filmId: movie.id },
            })
          );
        }
      }
  
      // reset UI
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
          className="text-sm text-yellow-400 hover:underline"
        >
          click to add your take
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
              {busy ? "Saving…" : "Post take"}
            </button>
          </div>
        </div>
      )}
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
  
  const { user, profile, saveProfilePatch } = useUser();
  const [isMember, setIsMember] = useState(false);

  const { id: routeId, clubParam } = useParams();
  const idParam = (clubParam || routeId || '').trim();
  const navigate = useNavigate();


  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lastAdded, setLastAdded] = useState(null);
  // Tracks the film_id currently persisted in DB (for archiving takes on change)
const [persistedFilmId, setPersistedFilmId] = useState(null);



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
const [membersLoading, setMembersLoading] = useState(true);
const [selectedResultId, setSelectedResultId] = useState(null);
const [membersErr, setMembersErr] = useState("");
const myMembership = members?.find(m => m.user_id === user?.id);
const { isStaff } = useStaff(club?.id);
const [nextAvg, setNextAvg] = useState(null);
const [isClubAdmin, setIsClubAdmin] = useState(false);
const allowed = ["president", "vice", "vice_president", "admin", "moderator", "partner"];
const [tmdbBusy, setTmdbBusy] = useState(false);
const [nominations, setNominations] = useState([]);











// re-fetch members (used after role changes)
const loadMembers = useCallback(async () => {
  if (!club?.id) return;
  try {
    const { data, error } = await supabase
      .from("club_members")
      .select(`
        user_id,
        role,
        profiles:profiles (id, slug, display_name, avatar_url)
      `)
      .eq("club_id", club.id);

    if (error) throw error;

    // leadership first, then name
    const priority = { president: 0, vice_president: 1, editor_in_chief: 2, member: 3 };
    const sorted = (data || []).slice().sort((a, b) => {
      const pa = priority[a?.role] ?? 9;
      const pb = priority[b?.role] ?? 9;
      if (pa !== pb) return pa - pb;
      const an = (a?.profiles?.display_name || "").toLowerCase();
      const bn = (b?.profiles?.display_name || "").toLowerCase();
      return an.localeCompare(bn);
    });

    setMembers(sorted);
  } catch (e) {
    console.error("loadMembers failed:", e);
  } finally {
    setMembersLoading(false);
  }
}, [club?.id, setMembers, setMembersLoading]);




// call it on mount/club change
useEffect(() => {
  if (!club?.id) return;
  setMembersLoading(true);
  loadMembers();
}, [club?.id, loadMembers]);

// RPC helpers
const setMemberRole = async (userId, role) => {
  if (!club?.id) return;
  const { error } = await supabase.rpc("set_member_role", {
    p_club: club.id,
    p_target: userId,
    p_role: role, // 'vice_president' | 'editor_in_chief' | 'member'
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
    if (!club?.id || !club?.nextEvent?.movieId) {
      if (!cancelled) setOpenReview(null);
      return;
    }
    const { data, error } = await supabase
      .from("club_reviews")
      .select("id, club_id, tmdb_id, title, poster_url, year, state, opens_at, closes_at")
      .eq("club_id", club.id)
      .eq("tmdb_id", club.nextEvent.movieId)
      .eq("state", "open")
      .order("opens_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cancelled) setOpenReview(error ? null : data || null);
  }
  fetchOpenReview();
  return () => { cancelled = true; };
}, [club?.id, club?.nextEvent?.movieId]);


useEffect(() => {
  if (!club?.id) return;

  let cancelled = false;

  async function loadMembers() {
    try {
      if (!club?.id) return; // avoid filtering on undefined/null
  
      // 1) Fetch membership rows only (no join here)
      const { data: memberRows, error: mErr } = await supabase
        .from("club_members")
        .select("user_id, role") // keep it simple — exact column names
        .eq("club_id", club.id);
  
      if (mErr) {
        console.error("loadMembers failed (members):", mErr.message, mErr.details, mErr.hint);
        return;
      }
  
      if (!memberRows?.length) {
        setMembers([]);
        return;
      }
  
      // 2) Fetch profiles for those user_ids
      const userIds = memberRows.map((r) => r.user_id).filter(Boolean);
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, avatar_url, slug, display_name");
  
      if (pErr) {
        console.error("loadMembers failed (profiles):", pErr.message, pErr.details, pErr.hint);
        return;
      }
  
      // 3) Merge
      const byId = new Map(profiles.map((p) => [p.id, p]));
      const merged = memberRows.map((m) => ({
        ...m,
        profiles: byId.get(m.user_id) || null,
      }));
  
      setMembers(merged);
    } catch (e) {
      console.error("loadMembers failed (exception):", e);
    }
  }
  
  // realtime refresh when membership changes
  const ch = supabase
    .channel(`members:${club.id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "club_members", filter: `club_id=eq.${club.id}` },
      loadMembers
    )
    .subscribe();

  return () => {
    cancelled = true;
    supabase.removeChannel(ch);
  };
}, [club?.id]);


  

  // Loader: try UUID → slug → id (covers numeric IDs too)
  useEffect(() => {
    let cancelled = false;

    const loadClub = async () => {
      setDebugParam(idParam);
      if (!idParam) return;
      setLoading(true);
      setNotFound(false);
      setLastError(null);
      setLastTried('');

      // SELECT now includes avatar + name_last_changed_at
      const selectCols = `
  id, slug, name, tagline, about, location,
  banner_url, profile_image_url, name_last_changed_at,
  next_screening_title, next_screening_at, next_screening_location, next_screening_caption, next_screening_poster,
  next_screening_tmdb_id,
  featured_posters
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
            if (!mapped.nextEvent.poster && mapped.nextEvent.title) {
              const guess = await fetchPosterFromTMDB(cleanTitleForSearch(mapped.nextEvent.title));
              mapped.nextEvent.poster = guess?.poster || fallbackNext;
            }
            try {
              const raw = localStorage.getItem(`sf_featured_map_${data.id}`);
              mapped.featuredMap = raw ? JSON.parse(raw) : {};
            } catch {}
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
        if (!data) {
          // 3) Try id (non-UUID)
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
          if (!mapped.nextEvent.poster && mapped.nextEvent.title) {
            const guess = await fetchPosterFromTMDB(cleanTitleForSearch(mapped.nextEvent.title));
            mapped.nextEvent.poster = guess?.poster || fallbackNext;
          }
          try {
            const raw = localStorage.getItem(`sf_featured_map_${data.id}`);
            mapped.featuredMap = raw ? JSON.parse(raw) : {};
          } catch {}
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
  }, [idParam]);

  // Normalize to pretty slug when available
  useEffect(() => {
    if (club?.slug && clubParam && club.slug !== clubParam) {
      navigate(`/clubs/${club.slug}`, { replace: true });
    }
  }, [club?.slug, clubParam, navigate]);

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
        const { data, error } = await supabase
          .from("club_members")
          .select(`
            user_id,
            role,
            profiles:profiles!club_members_user_id_fkey (
              id, slug, display_name, avatar_url
            )
          `)
          .eq("club_id", club.id);
  
        if (error) throw error;
  
        const priority = { president: 0, vice_president: 1, editor_in_chief: 2, member: 3 };
        const sorted = (data || []).slice().sort((a, b) => {
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
  const isPresident = viewerMember?.role === ROLE.PRESIDENT;
  const isVice = viewerMember?.role === ROLE.VICE;
  const hasRole = (role) => Array.isArray(user?.roles) && user.roles.includes(role);
  const isMemberByContext =
    Array.isArray(user?.joinedClubs) && (club?.id ? user.joinedClubs.some((c) => String(c) === String(club.id)) : false);
    
  // Robust gate for member-only sections

  const nextEvent = club?.nextEvent || {};
const nextFilmId =nextEvent.movieId ?? nextEvent.movie_id ?? nextEvent.tmdb_id ?? null;
const nextPoster = nextEvent.poster || nextEvent.poster_url || null;
const nextTitle  = nextEvent.title  || nextEvent.movieTitle || null;


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
        hasRole("editor_in_chief") ||
        isStaff
      );
    }
  })();
  return () => { ignore = true; };
}, [club?.id, user?.id, isPresident, isVice, isStaff]);

const canSeeMembersOnly =
!!user?.id &&
(canEdit || isPresident || isVice || isStaff || (typeof hasRole === "function" && hasRole("editor_in_chief")) || isMember);







  const updateField = (section, field, value) => {
    setClub((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  // Hydrate recent activity feed for this club (uses the same view)
useEffect(() => {
  let cancelled = false;

  (async () => {
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
}, [club?.id]);

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
        hasRole("editor_in_chief") ||
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
    if (!club?.id || !club?.nextEvent?.movieId) { setNextAvg(null); return; }
    const { data, error } = await supabase
      .from("film_ratings")
      .select("rating")
      .eq("club_id", club.id)
      .eq("film_id", club.nextEvent.movieId);
    if (error) { console.warn("avg rating error:", error.message); setNextAvg(null); return; }
    const arr = data || [];
    const avg = arr.length ? (arr.reduce((s, r) => s + r.rating, 0) / arr.length).toFixed(1) : null;
    setNextAvg(avg);
  }
  loadAvg();
}, [club?.id, club?.nextEvent?.movieId]);

useEffect(() => {
  function onRatingsUpdated(e) {
    if (!club?.id || !club?.nextEvent?.movieId) return;
    if (e?.detail?.clubId !== club.id) return;
    if (e?.detail?.filmId !== club.nextEvent.movieId) return;
    // re-run the same average fetch
    (async () => {
      const { data } = await supabase
        .from("film_ratings")
        .select("rating")
        .eq("club_id", club.id)
        .eq("film_id", club.nextEvent.movieId);
      const arr = data || [];
      const avg = arr.length ? (arr.reduce((s, r) => s + r.rating, 0) / arr.length).toFixed(1) : null;
      setNextAvg(avg);
    })();
  }
  window.addEventListener("ratings-updated", onRatingsUpdated);
  return () => window.removeEventListener("ratings-updated", onRatingsUpdated);
}, [club?.id, club?.nextEvent?.movieId]);

useEffect(() => {
  let cancelled = false;

  async function check() {
    if (!user?.id || !club?.id) {
      if (!cancelled) setIsClubAdmin(false);
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
}, [user?.id, club?.id]);






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

  const handleBannerCropComplete = (croppedDataUrl) => {
    setClub((prev) => ({ ...prev, banner: croppedDataUrl }));
    setShowBannerCropper(false);
    setRawBannerImage(null);
  };
  const openReCrop = () => {
    if (!club?.banner) return;
    setRawBannerImage(club.banner);
    setShowBannerCropper(true);
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
        return;
      }

      const { error } = await supabase
        .from('clubs')
        .update({ name: newName })
        .eq('id', club.id);

      if (error) throw error;

      setClub((p) => ({ ...p, name: newName, nameLastChangedAt: new Date().toISOString() }));
      setRenameOk('Club name updated.');
      await postActivity(`renamed the club to "${newName}"`);
    } catch (err) {
      setRenameError(
        err?.message?.includes('90 days')
          ? err.message
          : (err?.message || 'Unable to rename right now.')
      );
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

  // NEW: persist next screening fields to Supabase
  const saveNextScreening = async () => {
    if (!club?.id) return;
  
    // capture what’s currently persisted as "old"
    const oldFilmId = persistedFilmId || null;
  
    try {
      // save new next screening fields
      const { error: updErr } = await supabase
        .from("clubs")
        .update({
          next_screening_title: club.nextEvent.title || null,
          next_screening_at: club.nextEvent.date || null,
          next_screening_location: club.nextEvent.location || null,
          next_screening_caption: club.nextEvent.caption || null,
          next_screening_poster: club.nextEvent.poster || null,
          next_screening_tmdb_id: club.nextEvent.movieId || null, // new film id (may be same as before)
        })
        .eq("id", club.id);
  
      if (updErr) throw updErr;
  
      // if the film actually changed, archive old takes
      if (oldFilmId && oldFilmId !== (club.nextEvent.movieId || null)) {
        await supabase
          .from("club_film_takes")
          .update({ is_archived: true })
          .eq("club_id", club.id)
          .eq("film_id", oldFilmId)
          .eq("is_archived", false);
      }
  
      // update our local tracker to the new persisted film id
      setPersistedFilmId(club.nextEvent.movieId || null);
    } catch (e) {
      console.error("Failed to save next screening:", e?.message || e);
      alert("Could not save the next screening.");
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
  const countdown = club?.nextEvent?.date ? getCountdown(club.nextEvent.date) : null;
  
  // Compute next allowed rename date (client hint only)
  const nextRenameDate = club?.nameLastChangedAt
    ? new Date(new Date(club.nameLastChangedAt).getTime() + 90 * 24 * 60 * 60 * 1000)
    : null;
  
    return (
      <div className="min-h-screen bg-black text-white">
        {/* Banner */}
        <div
  className="h-[276px] bg-cover bg-center flex items-end px-6 py-4 relative rounded-2xl border-8 border-zinc-900 overflow-visible"
  style={{ backgroundImage: `url(${club.banner})` }}
  aria-label={`${club.name} banner`}
>
          {/* LEFT: avatar + name */}
          <div className="flex items-end gap-4">
            <div className="relative h-20 w-20 rounded-full overflow-hidden border-2 border-zinc-800 bg-zinc-900">
              <img
                src={club.profileImageUrl || fallbackAvatar}
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
                      if (f) handleAvatarUpload(f);
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

  {/* Ellipsis / Leave club */}
  <LeaveClubMenu
    clubId={club.id}
    isMember={isMember}
    onLeft={() => navigate("/clubs")}
  />

  {/* Edit toggle */}
  {canEdit && (
    <button
      onClick={() => setIsEditing(!isEditing)}
      className="bg-zinc-800 px-3 py-1 rounded text-sm hover:bg-zinc-700"
      type="button"
    >
      {isEditing ? "Finish Editing" : "Edit"}
    </button>
  )}
</div>

        </div>
        {/* end banner */}
    
        {/* Notice Board — now global, under the banner */}
        <div className="mt-6">
          <ClubNoticeBoard clubId={club.id} />
        </div>
    
        {isClubAdmin && (
          <Link
            to={`/clubs/${club.slug || club.id}/requests`}
            className="text-sm text-yellow-400 hover:underline"
          >
            Requests
          </Link>
        )}
    
        {isStaff && (
          <div className="mt-6">
            <PointsReviewPanel
              clubId={club.id}
              onChange={() => {
                // optional: toast; wide card & leaderboard auto-refresh via event
              }}
            />
          </div>
        )}
    
        {/* DEBUG — remove after confirming */}
        <div className="mt-2 text-[11px] text-zinc-400 px-6">
          staff: {String(isStaff)} • clubId: {club?.id || "—"}
        </div>
    
        {/* Transparency: recent point awards */}
        <div className="mt-4 px-6">
          <RecentPointAwards clubId={club.id} />
        </div>
    
        {/* Banner cropper modal */}
        {showBannerCropper && rawBannerImage && (
          <BannerCropper
            imageSrc={rawBannerImage}
            aspect={16 / 9}
            onCancel={() => {
              setShowBannerCropper(false);
              setRawBannerImage(null);
            }}
            onCropComplete={handleBannerCropComplete}
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
        isStaff ||
        (typeof hasRole === "function" && hasRole("editor_in_chief")));

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
          : (typeof hasRole === "function" && hasRole("editor_in_chief"))
          ? "editor_in_chief"
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
          if (m.role === "editor_in_chief") roleLabel = "Editor-in-Chief";

          return (
            <div key={m.id ?? `member-${i}`} className="flex flex-col items-center w-20">
              <Link
                to={href}
                aria-label={roleLabel || "Member"}
                className="block h-12 w-12 rounded-full overflow-hidden ring-1 ring-white/10 hover:ring-yellow-400/60 transition"
              >
                <img
                  src={m.avatar || "/avatar_placeholder.png"}
                  alt={roleLabel || "Member"}
                  className="h-full w-full object-cover"
                  onError={(e) => {
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
      {club.nextEvent?.poster && (
        <div className="inline-block rounded-xl border-[4px] border-yellow-500 overflow-hidden group">
          <Link
            to={club.nextEvent?.movieId ? `/movies/${club.nextEvent.movieId}` : "#"}
            onClick={(e) => {
              if (!club.nextEvent?.movieId) e.preventDefault();
            }}
            className="block transition-transform duration-150 group-hover:scale-[1.03]"
            title={club.nextEvent?.movieTitle || "Open movie details"}
          >
            <img
              ref={posterRef}
              src={club.nextEvent.poster}
              alt={club.nextEvent?.movieTitle || "Next screening poster"}
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
              <img
                key={movie.id}
                src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                alt={`${movie.title || "Film"} poster`}
                className="cursor-pointer hover:opacity-80"
                onClick={() => {
                  const pickedTitle = movie.title || movie.name || "";
                  const pickedPoster = movie.poster_path
                    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                    : (movie.posterUrl || movie.backdropUrl || "");

                  updateField("nextEvent", "poster", pickedPoster);
                  updateField("nextEvent", "movieId", movie.id);
                  updateField("nextEvent", "movieTitle", pickedTitle);
                  updateField("nextEvent", "title", pickedTitle);
                  setNextSearchResults([]);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>

    {/* Right: Details / Ticket */}
    <div className="h-full flex flex-col self-start">
      {isEditing && canEdit ? (
        <div className="space-y-3">
          {/* Title */}
          <label className="block text-xs uppercase tracking-wide text-zinc-400">Title</label>
          <input
            value={club.nextEvent.title}
            onChange={(e) => updateField("nextEvent", "title", e.target.value)}
            className="w-full bg-zinc-800 p-2 rounded"
            placeholder="Film title"
            aria-label="Event title"
          />

          {/* Location */}
          <label className="block text-xs uppercase tracking-wide text-zinc-400">Location</label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-yellow-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={club.nextEvent.location}
              onChange={(e) => updateField("nextEvent", "location", e.target.value)}
              className="w-full bg-zinc-800 p-2 pl-9 rounded"
              placeholder="Venue, area (e.g., Electric Cinema, Notting Hill)"
              aria-label="Event location"
            />
          </div>

          {/* Tagline */}
          <label className="block text-xs uppercase tracking-wide text-zinc-400">Tagline</label>
          <textarea
            value={club.nextEvent.caption}
            onChange={(e) => updateField("nextEvent", "caption", e.target.value)}
            className="w-full bg-zinc-800 p-2 rounded"
            placeholder="Optional note for the ticket"
            aria-label="Event caption"
          />

          {/* Date & time */}
          <label className="block text-xs uppercase tracking-wide text-zinc-400">Date &amp; time</label>
          <DatePicker
            selected={new Date(club.nextEvent.date)}
            onChange={(date) => updateField("nextEvent", "date", date.toISOString())}
            showTimeSelect
            dateFormat="Pp"
            className="bg-zinc-800 text-white p-2 rounded w-full"
          />

          {/* Save */}
          <div className="pt-2">
            <button
              type="button"
              onClick={saveNextScreening}
              className="inline-flex items-center gap-2 rounded bg-yellow-500 px-3 py-1.5 text-black text-sm font-semibold hover:bg-yellow-400"
            >
              Save Next Screening
            </button>
          </div>
        </div>
      ) : canSeeMembersOnly ? (
        <TicketCard
          title={club.nextEvent.title}
          tagline={club.nextEvent.caption}
          location={club.nextEvent.location}
          datetime={new Date(club.nextEvent.date).toLocaleString([], {
            dateStyle: "medium",
            timeStyle: "short",
          })}
          onClick={() => {
            navigate(`/clubs/${club.slug || club.id}/events/next`, {
              state: { clubName: club.name, event: club.nextEvent, clubId: club.id },
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

      {/* Film Takes */}
      {!nextFilmId ? (
        <div className="rounded-xl border border-zinc-800 bg-black/40 p-3 text-sm text-zinc-300 mt-3">
          {canSeeMembersOnly ? (
            canEdit ? (
              <div className="flex items-center justify-between gap-3">
                <span>No film selected for this screening.</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    document.querySelector('input[aria-label="Search film title"]')?.focus();
                  }}
                  className="rounded bg-yellow-500 px-3 py-1.5 text-black text-sm font-semibold hover:bg-yellow-400"
                >
                  Pick a film
                </button>
              </div>
            ) : (
              "A film hasn’t been chosen yet. Once the club sets the next film, members’ takes will appear here."
            )
          ) : (
            "Film Takes are for members."
          )}
        </div>
      ) : (
        <ClubFilmTakesSection
          clubId={club.id}
          filmId={nextFilmId}
          canSeeMembersOnly={canSeeMembersOnly}
        />
      )}

      {/* Club rating + submissions */}
      {nextFilmId ? (
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-zinc-400 flex items-center gap-2">
            Club rating
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] lowercase tracking-normal text-zinc-300">
              {openReview ? "open" : "—"}
            </span>
          </div>

          <div className="mt-1 text-2xl font-semibold">
            <FilmAverageCell clubId={club.id} filmId={nextFilmId} average={nextAvg} />
          </div>

          {/* Quick personal take (posts to profiles.film_takes) */}
          <div className="mt-3">
            <ClubAddTake
              movie={{ id: nextFilmId, title: nextTitle, poster: nextPoster }}
              club={{ id: club.id, name: club.name, slug: club.slug }}
            />
          </div>

          {/* Collective review submission */}
          {openReview && canSeeMembersOnly && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-black/40 p-3">
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
                className="mt-1 w-24 bg-zinc-800 p-2 rounded text-white"
              />

              <label className="mt-3 block text-xs uppercase tracking-wide text-zinc-400">
                Your blurb
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                className="mt-1 w-full bg-zinc-800 p-2 rounded text-white"
                placeholder="A few words about the film…"
              />

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    if (!openReview?.id) return;
                    await handleSubmitClubReview(openReview.id, {
                      rating_5: rating,
                      blurb: text,
                      aspect_key: aspect || null,
                    });
                    setText("");
                    setRating(null);
                    setAspect(null);
                  }}
                  disabled={rating == null}
                  className="rounded-lg bg-yellow-500 px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50"
                >
                  Submit
                </button>
              </div>
            </div>
          )}
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
  <FeaturedFilms
    club={club}
    canEdit={canEdit}
    showSearch={isEditing && canEdit}
    onChange={(next) => setClub((p)=> p ? { ...p, featuredFilms: next } : p)}
  />
</div>

{/* Nominations full-width band */}
{/* Nominations full-width band */}
<NominationsCarousel
  clubId={club.id}
  canEdit={canEdit}
  isEditing={isEditing}
  nominations={nominations}
  onRemove={removeNomination}
/>



<div className="mt-6">
  <ClubYearInReview clubId={club.id} />
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
{/* close page wrapper */}
</div>
);
}
