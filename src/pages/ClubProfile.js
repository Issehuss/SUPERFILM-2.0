// src/pages/ClubProfile.jsx
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import {
  MapPin,
  Film,
  Star,
  ImagePlus,
  Crop as CropIcon,
  CalendarClock,
  Trash2,               // ✅ NEW
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import BannerCropper from '../components/BannerCropper';
import MembersStrip from "../components/MembersStrip";
import supabase from '../supabaseClient.js';
import NominationsPanel from "../components/NominationsPanel";

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

const cleanTitleForSearch = (title) =>
  title.replace(/screening of/gi, '').replace(/discussion night/gi, '').replace(/['"]/g, '').trim();

const fetchPosterFromTMDB = async (title) => {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&api_key=cfa8fb0dd27080b54073069a5c29a185`
    );
    const data = await response.json();
    const firstResult = data.results?.[0];
    return firstResult?.poster_path ? `https://image.tmdb.org/t/p/w500${firstResult.poster_path}` : null;
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
    nextEvent: {
      title: row.next_screening_title || 'Screening',
      date: row.next_screening_at || new Date(Date.now() + 7 * 86400000).toISOString(),
      location: row.next_screening_location || row.location || '',
      caption: row.next_screening_caption || '',
      poster: row.next_screening_poster || fallbackNext,
      attendingCount: Number(row?.attending_count) || 0, // safe even if column not selected
    },
    featuredFilms: Array.isArray(row.featured_posters) ? row.featured_posters : [],
    membersList: [],
    members: 0,
    activityFeed: [],
  };
}

/* -----------------------------
   Component
------------------------------*/
export default function ClubProfile() {
  const { id: routeId, clubParam } = useParams();
  const idParam = (clubParam || routeId || '').trim();
  const navigate = useNavigate();
  const { user } = useUser();

  const [club, setClub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // debug info
  const [debugParam, setDebugParam] = useState('');
  const [lastError, setLastError] = useState(null);
  const [lastTried, setLastTried] = useState('');

  const [isEditing, setIsEditing] = useState(false);
  const [featuredSearch, setFeaturedSearch] = useState('');
  const [featuredResults, setFeaturedResults] = useState([]);
  const [nextSearch, setNextSearch] = useState('');
  const [nextSearchResults, setNextSearchResults] = useState([]);

  const [showBannerCropper, setShowBannerCropper] = useState(false);
  const [rawBannerImage, setRawBannerImage] = useState(null);

  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

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

      // ⛔ attending_count removed from SELECT
      const selectCols = `
        id, slug, name, tagline, about, location,
        banner_url,
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
              mapped.nextEvent.poster =
                (await fetchPosterFromTMDB(cleanTitleForSearch(mapped.nextEvent.title))) || fallbackNext;
            }
            setClub(mapped);
            setLoading(false);
            return;
          }
        }

        // 2) Try slug
        setLastTried((s) => s ? `${s} → slug` : 'slug');
        let { data, error } = await supabase
          .from('clubs')
          .select(selectCols)
          .eq('slug', idParam)
          .maybeSingle();

        if (cancelled) return;

        if (error) setLastError(error);
        if (!data) {
          // 3) Try id (numeric/string)
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
            mapped.nextEvent.poster =
              (await fetchPosterFromTMDB(cleanTitleForSearch(mapped.nextEvent.title))) || fallbackNext;
          }
          setClub(mapped);
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
              avatar: r.user_id === user?.id ? (user?.avatar || '/avatars/default.jpg') : '/avatars/default.jpg',
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

  const handleFeaturedSearch = async () => {
    if (!featuredSearch.trim()) return;
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(featuredSearch)}&api_key=cfa8fb0dd27080b54073069a5c29a185`);
    const data = await res.json();
    setFeaturedResults(data.results || []);
  };

  const handleNextEventSearch = async () => {
    if (!nextSearch.trim()) return;
    const res = await fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(nextSearch)}&api_key=cfa8fb0dd27080b54073069a5c29a185`);
    const data = await res.json();
    setNextSearchResults(data.results || []);
  };

  // ✅ NEW: persist featured posters to Supabase (no-op for local/demo)
  const persistFeatured = async (nextArr) => {
    if (!UUID_RX.test(String(club?.id))) return; // skip if not a real UUID club
    const { error } = await supabase
      .from('clubs')
      .update({ featured_posters: nextArr })
      .eq('id', club.id);
    if (error) throw error;
  };

  // ✅ UPDATED: add featured film & persist
  const addFeaturedFilm = async (url) => {
    setClub((prev) => {
      const next = [...(prev.featuredFilms || []), url];
      return {
        ...prev,
        featuredFilms: next,
        activityFeed: [{ id: `a_${Date.now()}`, type: 'feature', text: 'Added a featured film', ts: Date.now() }, ...(prev.activityFeed || [])],
      };
    });

    try {
      const nextArr = [...(club?.featuredFilms || []), url];
      await persistFeatured(nextArr);
    } catch (e) {
      // revert on error
      setClub((prev) => ({
        ...prev,
        featuredFilms: (prev.featuredFilms || []).filter((u, i) => !(i === (prev.featuredFilms || []).length - 1 && u === url)),
      }));
      alert(e?.message || 'Could not save featured films.');
    }
  };

  // ✅ NEW: remove featured film (by index) & persist
  const removeFeaturedFilm = async (index) => {
    if (!club) return;
    const prev = club.featuredFilms || [];
    if (index < 0 || index >= prev.length) return;

    const next = prev.filter((_, i) => i !== index);
    // optimistic UI
    setClub((p) => ({ ...p, featuredFilms: next }));

    try {
      await persistFeatured(next);
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
        const optimistic = [...list, { id: currentUserId, name: user?.name || 'You', avatar: user?.avatar || '/avatars/default.jpg', role: ROLE.NONE }];
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
      const optimistic = [...prev, { id: currentUserId, name: user?.name || 'You', avatar: user?.avatar || '/avatars/default.jpg', role: ROLE.NONE }];
      setClub((p) => ({ ...p, membersList: optimistic, members: optimistic.length }));
      const { error } = await supabase.from('club_members').insert([{ club_id: club.id, user_id: currentUserId, role: null }]);
      if (error) {
        setClub((p) => ({ ...p, membersList: prev, members: prev.length }));
        alert(error.message || 'Could not join the club.');
      }
    }
  };

  const setMemberRole = async (userId, role) => {
    if (!club?.id) return;
    const iAmPresident = (club?.membersList || []).some(m => m.id === currentUserId && m.role === ROLE.PRESIDENT);
    if (!(iAmPresident || (Array.isArray(user?.roles) && user.roles.includes('president')))) return;

    const prev = club.membersList;
    setClub((p) => ({ ...p, membersList: (p.membersList || []).map(m => m.id === userId ? { ...m, role } : m) }));
    if (!UUID_RX.test(String(club.id))) return;

    const { error } = await supabase.from('club_members').update({ role }).eq('club_id', club.id).eq('user_id', userId);
    if (error) {
      setClub((p) => ({ ...p, membersList: prev }));
      alert(error.message || 'Could not update role.');
    }
  };

  const transferPresidency = async (newPresidentId) => {
    if (!club?.id) return;
    const iAmPresident = (club?.membersList || []).some(m => m.id === currentUserId && m.role === ROLE.PRESIDENT);
    if (!(iAmPresident || (Array.isArray(user?.roles) && user.roles.includes('president')))) return;
    if (!window.confirm('Transfer presidency to this member?')) return;

    const prev = club.membersList;
    setClub((p) => ({
      ...p,
      membersList: (p.membersList || []).map((m) => {
        if (m.id === newPresidentId) return { ...m, role: ROLE.PRESIDENT };
        if (m.id === currentUserId) return { ...m, role: ROLE.NONE };
        return m;
      }),
    }));
    if (!UUID_RX.test(String(club.id))) return;

    const { error: e1 } = await supabase.from('club_members').update({ role: ROLE.PRESIDENT }).eq('club_id', club.id).eq('user_id', newPresidentId);
    const { error: e2 } = await supabase.from('club_members').update({ role: null }).eq('club_id', club.id).eq('user_id', currentUserId);
    if (e1 || e2) {
      setClub((p) => ({ ...p, membersList: prev }));
      alert((e1 || e2)?.message || 'Could not transfer presidency.');
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

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Banner */}
      <div
        className="h-[276px] bg-cover bg-center flex items-end px-6 py-4 relative rounded-2xl border-8 border-zinc-900 overflow-hidden"
        style={{ backgroundImage: `url(${club.banner})` }}
        aria-label={`${club.name} banner`}
      >
        <div>
          <h1 className="text-3xl font-bold">{club.name}</h1>
        </div>

        {canEdit && isEditing && (
          <label className="absolute top-3 right-12 bg-black bg-opacity-60 rounded-full p-2 cursor-pointer hover:bg-opacity-80" aria-label="Upload new banner image">
            <ImagePlus size={18} />
            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'banner')} className="hidden" />
          </label>
        )}

        {canEdit && isEditing && (
          <button onClick={openReCrop} title="Re-crop banner" className="absolute top-3 right-28 bg-black bg-opacity-60 rounded-full p-2 hover:bg-opacity-80" aria-label="Re-crop banner">
            <CropIcon size={18} />
          </button>
        )}

        {canEdit && (
          <button onClick={() => setIsEditing(!isEditing)} className="ml-auto bg-zinc-800 px-3 py-1 rounded text-sm hover:bg-zinc-700">
            {isEditing ? 'Finish Editing' : 'Edit'}
          </button>
        )}
      </div>

      {/* Members Strip */}
      <div className="mt-4 px-6">
        <MembersStrip
          members={(club?.membersList || []).map((m) => ({ id: m.id, name: m.name, avatarUrl: m.avatar, role: m.role }))}
          totalCount={club?.members || (club?.membersList?.length ?? 0)}
          isMember={isMember}
          canJoin={true}
          onJoin={handleToggleMembership}
          maxVisible={12}
          title="Members"
          onOpenFullList={() => setShowMembersDialog(true)}
        />
      </div>

      {/* Banner cropper modal */}
      {showBannerCropper && rawBannerImage && (
        <BannerCropper
          imageSrc={rawBannerImage}
          aspect={16 / 9}
          onCancel={() => { setShowBannerCropper(false); setRawBannerImage(null); }}
          onCropComplete={handleBannerCropComplete}
        />
      )}

      {countdown && (
        <div className={`mt-4 mx-6 px-4 py-2 rounded-lg w-fit font-mono text-sm ${countdown.isUrgent ? 'bg-red-600' : 'bg-yellow-500'} text-black`} aria-live="polite">
          {countdown.days}d {countdown.hours}h {countdown.minutes}m until screening
        </div>
      )}

      <div className="p-6 grid md:grid-cols-2 gap-6">
        {/* Next Screening - Poster */}
        <div>
          <h2 className="text-lg font-bold text-yellow-400 flex items-center mb-2">
            <Film className="w-5 h-5 mr-2" /> Next Screening
          </h2>
          <img src={club.nextEvent.poster} alt="Next screening poster" className="rounded-lg w-full max-w-sm" />
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
                    alt={`${movie.title || 'Film'} poster`}
                    className="cursor-pointer hover:opacity-80"
                    onClick={() => {
                      updateField('nextEvent', 'poster', `https://image.tmdb.org/t/p/w500${movie.poster_path}`);
                      setNextSearchResults([]); // clear results after choosing
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Next Screening - Details / Ticket */}
        <div>
          {isEditing && canEdit ? (
            <div className="space-y-3">
              {/* Title */}
              <label className="block text-xs uppercase tracking-wide text-zinc-400">
                Title
              </label>
              <input
                value={club.nextEvent.title}
                onChange={(e) => updateField('nextEvent', 'title', e.target.value)}
                className="w-full bg-zinc-800 p-2 rounded"
                placeholder="Film title"
                aria-label="Event title"
              />

              {/* Location (dedicated field) */}
              <label className="block text-xs uppercase tracking-wide text-zinc-400">
                Location
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-yellow-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={club.nextEvent.location}
                  onChange={(e) => updateField('nextEvent', 'location', e.target.value)}
                  className="w-full bg-zinc-800 p-2 pl-9 rounded"
                  placeholder="Venue, area (e.g., Electric Cinema, Notting Hill)"
                  aria-label="Event location"
                />
              </div>

              {/* Tagline / caption */}
              <label className="block text-xs uppercase tracking-wide text-zinc-400">
                Tagline
              </label>
              <textarea
                value={club.nextEvent.caption}
                onChange={(e) => updateField('nextEvent', 'caption', e.target.value)}
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
                onChange={(date) => updateField('nextEvent', 'date', date.toISOString())}
                showTimeSelect
                dateFormat="Pp"
                className="bg-zinc-800 text-white p-2 rounded w-full"
              />
            </div>
          ) : (
            <TicketCard
              title={club.nextEvent.title}
              tagline={club.nextEvent.caption}
              location={club.nextEvent.location}
              datetime={new Date(club.nextEvent.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              onClick={() => {
                navigate(`/clubs/${club.slug || club.id}/events/next`, {
                  state: { clubName: club.name, event: club.nextEvent, clubId: club.id },
                });
              }}
            />
          )}
        </div>
      </div>

      {/* Featured Films */}
      <div className="px-6 pt-8">
        <h2 className="text-lg font-bold text-yellow-400 flex items-center mb-2">
          <Star className="w-5 h-5 mr-2" /> Featured Films
        </h2>
        {isEditing && canEdit && (
          <div className="flex gap-2 items-center mb-4">
            <input
              value={featuredSearch}
              onChange={(e) => setFeaturedSearch(e.target.value)}
              className="bg-zinc-800 p-2 rounded w-full"
              placeholder="Search for films..."
              aria-label="Search featured films"
            />
            <button onClick={handleFeaturedSearch} className="bg-yellow-500 text-black px-4 py-2 rounded">Search</button>
          </div>
        )}

        {/* ✅ UPDATED GRID WITH REMOVE BUTTON */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(club.featuredFilms || []).map((url, idx) => (
            <div key={`${url}-${idx}`} className="relative group rounded-lg overflow-hidden">
              <img src={url} className="w-full h-full object-cover block" alt="Featured film poster" />
              {isEditing && canEdit && (
                <button
                  type="button"
                  onClick={() => removeFeaturedFilm(idx)}
                  className="
                    absolute top-2 right-2 inline-flex items-center justify-center
                    rounded-full bg-black/70 hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-yellow-500
                    w-8 h-8 opacity-0 group-hover:opacity-100 transition
                  "
                  title="Remove from Featured"
                  aria-label="Remove from Featured"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {isEditing && canEdit && featuredResults.map((movie) => (
            <img
              key={movie.id}
              src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
              className="cursor-pointer hover:opacity-80"
              onClick={() => addFeaturedFilm(`https://image.tmdb.org/t/p/w500${movie.poster_path}`)}
              alt={`${movie.title || 'Film'} poster`}
            />
          ))}
        </div>
      </div>

      {/* Nominations */}
      <div className="px-6 pt-8">
        <NominationsPanel
          clubId={club.id}
          canNominate={isMember}
          isLeader={isPresident || hasRole('president') || isVice || hasRole('vice_president')}
        />
      </div>

      {/* Recent Activity */}
      <div className="px-6 pt-8">
        <h2 className="text-lg font-bold text-yellow-400 mb-3">Recent Activity</h2>
        <ul className="space-y-2">
          {(club.activityFeed || []).slice(0, 6).map((item) => (
            <li key={item.id} className="text-sm text-zinc-300">
              <span className="text-zinc-400 mr-2">
                {new Date(item.ts).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
              {item.text}
            </li>
          ))}
          {(!club.activityFeed || club.activityFeed.length === 0) && (
            <li className="text-sm text-zinc-500">No activity yet.</li>
          )}
        </ul>
      </div>

      {/* About (moved to the bottom) */}
      <div className="px-6 pt-8 pb-12">
        <h2 className="text-lg font-bold text-yellow-400 mb-2">About</h2>
        {isEditing && canEdit ? (
          <textarea
            value={club.about}
            onChange={(e) => setClub((prev) => ({ ...prev, about: e.target.value }))}
            className="w-full bg-zinc-800 p-3 rounded text-sm"
            rows={4}
            aria-label="About the club"
          />
        ) : (
          <p className="text-sm text-zinc-300 leading-relaxed">{club.about || '—'}</p>
        )}
      </div>

      {/* Full Members Dialog */}
      {showMembersDialog && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl max-w-3xl w-full p-6 relative">
            <button className="absolute top-3 right-3 text-neutral-400 hover:text-white" onClick={() => setShowMembersDialog(false)} aria-label="Close">✕</button>
            <h2 className="text-xl font-bold mb-4 text-white">Members • {club?.members || club?.membersList?.length || 0}</h2>
            <input
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              placeholder="Search members…"
              className="w-full rounded-xl bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none ring-1 ring-neutral-800 focus:ring-yellow-500 mb-4"
              aria-label="Search members"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {(club?.membersList || [])
                .filter((m) => !memberSearch || (m.name || '').toLowerCase().includes(memberSearch.toLowerCase()))
                .map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl bg-neutral-900/60 p-2 ring-1 ring-neutral-800">
                    <img src={m.avatar} alt={m.name} className="h-10 w-10 rounded-full" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-neutral-100 flex items-center gap-2">
                        {m.name}
                        {m.role === ROLE.PRESIDENT && <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" title="President" />}
                        {m.role === ROLE.VICE && <span className="w-3 h-3 rounded-full bg-gray-400 inline-block" title="Vice President" />}
                      </p>
                    </div>
                    {(isPresident || hasRole('president')) && m.id !== user?.id && (
                      <div className="ml-auto flex items-center gap-2">
                        {m.role === ROLE.VICE ? (
                          <button onClick={() => setMemberRole(m.id, ROLE.NONE)} className="text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700">Remove VP</button>
                        ) : (
                          <button onClick={() => setMemberRole(m.id, ROLE.VICE)} className="text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700">Make VP</button>
                        )}
                        {m.role !== ROLE.PRESIDENT && (
                          <button onClick={() => transferPresidency(m.id)} className="text-[11px] px-2 py-1 rounded bg-yellow-500 text-black hover:bg-yellow-400">
                            Make President
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              {((club?.membersList || []).filter((m) => !memberSearch || (m.name || '').toLowerCase().includes(memberSearch.toLowerCase()))).length === 0 && (
                <p className="col-span-full text-sm text-neutral-400">No members match “{memberSearch}”.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}






























