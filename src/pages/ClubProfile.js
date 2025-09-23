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
    const response = await fetch(
      `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&api_key=cfa8fb0dd27080b54073069a5c29a185`
    );
    const data = await response.json();
    const firstResult = data.results?.[0];
    return firstResult?.poster_path ? { poster: `https://image.tmdb.org/t/p/w500${firstResult.poster_path}`, id: firstResult?.id, title: firstResult?.title } : null;
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
      attendingCount: Number(row?.attending_count) || 0,
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



/* -----------------------------
   Component
------------------------------*/

  const { id: routeId, clubParam } = useParams();
  const idParam = (clubParam || routeId || '').trim();
  const navigate = useNavigate();
  const { user } = useUser();

  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lastAdded, setLastAdded] = useState(null);


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
  if (!club?.id) return;

  let cancelled = false;

  async function loadMembers() {
    setMembersLoading(true);
    const { data, error } = await supabase
      .from("club_members_public_v")
      .select("user_id, display_name, avatar_url, member_role, member_joined_at")
      .eq("club_id", club.id)
      .order("member_role", { ascending: true });

    if (cancelled) return;
    if (error) {
      console.warn("[members] fetch error:", error);
      setMembers([]);
    } else {
      setMembers(data || []);
    }
    setMembersLoading(false);
  }

  loadMembers();

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

  // Hydrate members for real UUID clubs
  useEffect(() => {
    let cancelled = false;
    async function hydrateMembers() {
      if (!club?.id || !UUID_RX.test(String(club.id))) return;
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
  const isMember = !!viewerMember || isMemberByContext;

  const canEdit =
    isPresident || isVice || hasRole('admin') || hasRole('president') || hasRole('vice_president');

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


  const handleFeaturedSearch = async () => {
    if (!featuredSearch.trim()) return;
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(featuredSearch)}&api_key=cfa8fb0dd27080b54073069a5c29a185`);
    const data = await res.json();
    setFeaturedResults(data.results || []);
  };

  function onFeaturedKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleFeaturedSearch();
    }
  }
  

  const handleNextEventSearch = async () => {
    if (!nextSearch.trim()) return;
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(nextSearch)}&api_key=cfa8fb0dd27080b54073069a5c29a185`);
    const data = await res.json();
    setNextSearchResults(data.results || []);
  };

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
  try {
    await supabase
      .from("clubs")
      .update({
        next_screening_title: club.nextEvent.title || null,
        next_screening_at: club.nextEvent.date || null,
        next_screening_location: club.nextEvent.location || null,
        next_screening_caption: club.nextEvent.caption || null,
        next_screening_poster: club.nextEvent.poster || null,
      })
      .eq("id", club.id);
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
      className="h-[276px] bg-cover bg-center flex items-end px-6 py-4 relative rounded-2xl border-8 border-zinc-900 overflow-hidden"
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

      {/* RIGHT: banner editing controls */}
      {canEdit && isEditing && (
        <label
          className="absolute top-3 right-12 bg-black bg-opacity-60 rounded-full p-2 cursor-pointer hover:bg-opacity-80"
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
      )}

      {canEdit && isEditing && (
        <button
          onClick={openReCrop}
          title="Re-crop banner"
          className="absolute top-3 right-28 bg-black bg-opacity-60 rounded-full p-2 hover:bg-opacity-80"
          aria-label="Re-crop banner"
        >
          <CropIcon size={18} />
        </button>
      )}

      {canEdit && (
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="ml-auto bg-zinc-800 px-3 py-1 rounded text-sm hover:bg-zinc-700"
        >
          {isEditing ? "Finish Editing" : "Edit"}
        </button>
      )}
    </div>

    {/* Notice Board — now global, under the banner */}
    <div className="mt-6">
      <ClubNoticeBoard clubId={club.id} />
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
      ) : !members?.length ? (
        <div className="text-sm text-zinc-500">No members yet.</div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {members.map((m) => {
            const p = m?.profiles || {};
            const slug = p?.slug || m?.slug || null;
            const uid = p?.id || m?.user_id || null;
            const role = m?.role ?? m?.member_role ?? null;

            const href = slug ? `/u/${slug}` : uid ? `/profile/${uid}` : "#";
            const avatar =
              p?.avatar_url || m?.avatar_url || "/avatar_placeholder.png";

            let roleLabel = null;
            if (role === "president") roleLabel = "President";
            if (role === "vice_president") roleLabel = "Vice President";
            if (role === "editor_in_chief") roleLabel = "Editor-in-Chief";

            return (
              <div
                key={uid || slug || `member-${Math.random()}`}
                className="flex flex-col items-center w-16"
              >
                <Link
                  to={href}
                  aria-label={roleLabel || "Member"}
                  className="block h-12 w-12 rounded-full overflow-hidden ring-1 ring-white/10 hover:ring-yellow-400/60 transition"
                >
                  <img
                    src={avatar}
                    alt={roleLabel || "Member"}
                    className="h-full w-full object-cover"
                    onError={(e) => { e.currentTarget.src = "/avatar_placeholder.png"; }}
                  />
                </Link>
                {roleLabel && (
                  <span className="mt-1 text-[10px] text-yellow-400 text-center">
                    {roleLabel}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>

    {/* =========================
        Two-column grid (Poster • Details)
    ========================= */}
    <div className="p-6 grid md:grid-cols-2 gap-6">
      {/* Next Screening - Poster */}
      <div>
        <h2 className="text-lg font-bold text-yellow-400 flex items-center mb-2">
          <Film className="w-5 h-5 mr-2" /> Next Screening
        </h2>

        {club.nextEvent?.poster && (
          <Link
            to={club.nextEvent?.movieId ? `/movies/${club.nextEvent.movieId}` : "#"}
            onClick={(e) => {
              if (!club.nextEvent?.movieId) e.preventDefault();
            }}
            className="block rounded-lg overflow-hidden ring-0 transition-transform duration-150 hover:scale-[1.03] hover:ring-2 hover:ring-yellow-500/70 hover:shadow-xl"
            title={club.nextEvent?.movieTitle || "Open movie details"}
          >
            <img
              ref={posterRef}
              src={club.nextEvent.poster}
              alt={club.nextEvent?.movieTitle || "Next screening poster"}
              className="w-full max-w-sm h-auto object-cover"
              loading="lazy"
            />
          </Link>
        )}

        {canEdit && isEditing && (
          <div className="mt-2">
            <input
              value={nextSearch}
              onChange={(e) => setNextSearch(e.target.value)}
              className="bg-zinc-800 p-1 rounded w-full"
              placeholder="Search film title..."
              aria-label="Search film title"
            />
            <button
              onClick={handleNextEventSearch}
              className="bg-yellow-500 text-black px-2 py-1 mt-1 rounded"
            >
              Search
            </button>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {nextSearchResults.map((movie) => (
                <img
                  key={movie.id}
                  src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                  alt={`${movie.title || "Film"} poster`}
                  className="cursor-pointer hover:opacity-80"
                  onClick={() => {
                    updateField("nextEvent", "poster", `https://image.tmdb.org/t/p/w500${movie.poster_path}`);
                    updateField("nextEvent", "movieId", movie.id);
                    updateField("nextEvent", "movieTitle", movie.title || movie.name);
                    setNextSearchResults([]);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Next Screening - Details / Ticket + Chat Teaser */}
      <div className="h-full flex flex-col">
        {isEditing && canEdit ? (
          <div className="space-y-3">
            {/* Title */}
            <label className="block text-xs uppercase tracking-wide text-zinc-400">
              Title
            </label>
            <input
              value={club.nextEvent.title}
              onChange={(e) =>
                updateField("nextEvent", "title", e.target.value)
              }
              className="w-full bg-zinc-800 p-2 rounded"
              placeholder="Film title"
              aria-label="Event title"
            />

            {/* Location */}
            <label className="block text-xs uppercase tracking-wide text-zinc-400">
              Location
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-yellow-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={club.nextEvent.location}
                onChange={(e) =>
                  updateField("nextEvent", "location", e.target.value)
                }
                className="w-full bg-zinc-800 p-2 pl-9 rounded"
                placeholder="Venue, area (e.g., Electric Cinema, Notting Hill)"
                aria-label="Event location"
              />
            </div>

            {/* Tagline */}
            <label className="block text-xs uppercase tracking-wide text-zinc-400">
              Tagline
            </label>
            <textarea
              value={club.nextEvent.caption}
              onChange={(e) =>
                updateField("nextEvent", "caption", e.target.value)
              }
              className="w-full bg-zinc-800 p-2 rounded"
              placeholder="Optional note for the ticket"
              aria-label="Event caption"
            />

            {/* Date & time */}
            <label className="block text-xs uppercase tracking-wide text-zinc-400">
              Date &amp; time
            </label>
            <DatePicker
              selected={new Date(club.nextEvent.date)}
              onChange={(date) =>
                updateField("nextEvent", "date", date.toISOString())
              }
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
        ) : (
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
                state: {
                  clubName: club.name,
                  event: club.nextEvent,
                  clubId: club.id,
                },
              });
            }}
          />
        )}

        {/* Chat teaser */}
        <div ref={teaserWrapRef} className="mt-6 hidden md:block">
          <div
            className="rounded-2xl border border-zinc-800 bg-black/50 overflow-hidden"
            style={teaserHeight ? { height: teaserHeight } : undefined}
          >
            <ClubChatTeaserCard clubId={club.id} slug={club.slug} />
          </div>
        </div>
      </div>
    </div>

    {/* Club Intro: About + Featured Films (merged) */}
    <div className="px-6 pt-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* About (left) */}
        <div>
          <h2 className="text-lg font-bold text-yellow-400 mb-2">About</h2>
          {isEditing && canEdit ? (
            <textarea
              value={club.about}
              onChange={(e) => setClub((prev) => ({ ...prev, about: e.target.value }))}
              className="w-full bg-zinc-800 p-3 rounded text-sm"
              rows={6}
              aria-label="About the club"
            />
          ) : (
            <p className="text-sm text-zinc-300 leading-relaxed">
              {club.about || "—"}
            </p>
          )}
        </div>

        {/* Featured Films (right, spans 2 columns) */}
        <section className="lg:col-span-2">
          <h2 className="text-lg font-bold text-yellow-400 flex items-center mb-2">
            <Star className="w-5 h-5 mr-2" /> Featured Films
          </h2>

          {/* Search results (edit mode only) */}
          {isEditing && canEdit && featuredResults.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
              {featuredResults.map((m) => {
                const poster = m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : "";
                const isSelected = selectedResultId === m.id;

                async function handlePick() {
                  if (!poster) return;
                  setSelectedResultId(m.id);
                  await addFeaturedFilm(poster, {
                    id: m.id,
                    title: m.title || m.name,
                  });
                  setTimeout(() => {
                    setFeaturedResults((prev) => prev.filter((x) => x.id !== m.id));
                    setSelectedResultId(null);
                  }, 700);
                }

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={handlePick}
                    disabled={isSelected}
                    className={[
                      "group relative overflow-hidden rounded-lg ring-1 ring-white/10 bg-white/5",
                      "transition transform duration-150",
                      isSelected ? "ring-yellow-500 scale-[1.02]" : "hover:scale-[1.02]",
                    ].join(" ")}
                    title={m.title || m.name}
                  >
                    {!isSelected && (
                      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-yellow-500/10 ring-2 ring-yellow-500/70" />
                    )}
                    {isSelected && (
                      <>
                        <div className="pointer-events-none absolute inset-0 bg-yellow-500/20 ring-2 ring-yellow-500" />
                        <div className="pointer-events-none absolute top-2 right-2 rounded-full bg-black/70 p-1.5">
                          <Check className="w-4 h-4 text-yellow-400" />
                        </div>
                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-black/70 text-[11px] text-yellow-300 px-2 py-1 text-center">
                          Added!
                        </div>
                      </>
                    )}
                    <div className="aspect-[2/3] w-full overflow-hidden">
                      {poster ? (
                        <img
                          src={poster}
                          alt={m.title || m.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full grid place-items-center text-xs text-zinc-400">
                          No poster
                        </div>
                      )}
                    </div>
                    {!isSelected && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[11px] text-white px-2 py-1 text-center">
                        {m.title || m.name}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Current featured films grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {(club.featuredFilms || []).map((url, idx) => {
              const meta = club.featuredMap?.[url];

              const PosterInner = (
                <>
                  <div className="aspect-[2/3] w-full overflow-hidden rounded-lg">
                    <img
                      src={url}
                      alt={meta?.title ? `${meta.title} poster` : "Featured film poster"}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {isEditing && canEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFeaturedFilm(idx);
                      }}
                      className="absolute top-2 right-2 inline-flex items-center justify-center rounded-full bg-black/70 hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-yellow-500 w-7 h-7 opacity-0 group-hover:opacity-100 transition"
                      title="Remove from Featured"
                      aria-label="Remove from Featured"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  )}
                </>
              );

              if (meta?.id) {
                return (
                  <Link
                    key={`${url}-${idx}`}
                    to={`/movies/${meta.id}`}
                    className="relative group rounded-lg overflow-hidden ring-0 transition transform hover:scale-[1.02] hover:ring-2 hover:ring-yellow-500/70 hover:shadow-xl"
                    aria-label={meta?.title || "Open movie"}
                  >
                    {PosterInner}
                  </Link>
                );
              }

              return (
                <div
                  key={`${url}-${idx}`}
                  className="relative group rounded-lg overflow-hidden ring-0 bg-zinc-800 transition transform hover:scale-[1.02] hover:ring-2 hover:ring-yellow-500/70 hover:shadow-xl"
                  title={isEditing ? "Not linked to a movie" : undefined}
                >
                  {PosterInner}
                  {isEditing && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[11px] text-yellow-300 px-2 py-1 text-center">
                      Not linked — use search above to fix
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>

    {/* Nominations */}
    <NominationsPanel
      clubId={club.id}
      canNominate={isMember}
      isLeader={
        isPresident ||
        hasRole("president") ||
        isVice ||
        hasRole("vice_president")
      }
      canRemove={
        isEditing &&
        (isPresident ||
          hasRole("president") ||
          isVice ||
          hasRole("vice_president") ||
          hasRole("editor_in_chief"))
      }
      posterHoverClass="transition transform hover:scale-[1.02] hover:ring-2 hover:ring-yellow-500/70 hover:shadow-xl"
      onPosterClick={(movie) => movie?.id && navigate(`/movies/${movie.id}`)}
    />

    {/* Recent Activity */}
    <div className="px-6 pt-8">
      <h2 className="text-lg font-bold text-yellow-400 mb-3">Recent Activity</h2>
      <ul className="space-y-2">
        {(club.activityFeed || []).slice(0, 6).map((item) => (
          <li key={item.id} className="text-sm text-zinc-300">
            <span className="text-zinc-400 mr-2">
              {new Date(item.ts).toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </span>
            {item.text}
          </li>
        ))}
        {(!club.activityFeed || club.activityFeed.length === 0) && (
          <li className="text-sm text-zinc-500">No activity yet.</li>
        )}
      </ul>
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
); // end return
}   // end function ClubProfile

export default ClubProfile;



