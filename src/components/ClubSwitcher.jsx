// src/components/ClubSwitcher.jsx
import { useEffect, useState, useRef } from "react";
import { ChevronDown, Crown } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";
import useSafeSupabaseFetch from "../hooks/useSafeSupabaseFetch";
import useAppResume from "../hooks/useAppResume";

const CACHE_KEY = "cache:clubSwitcher:v1";
const CACHE_TTL_MS = 5 * 60 * 1000;

function readCache(userId) {
  if (!userId) return null;
  try {
    const raw = sessionStorage.getItem(`${CACHE_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at) return null;
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(userId, payload) {
  if (!userId) return;
  try {
    sessionStorage.setItem(
      `${CACHE_KEY}:${userId}`,
      JSON.stringify({ ...payload, at: Date.now() })
    );
  } catch {
    /* ignore cache errors */
  }
}

export default function ClubSwitcher({ className = "" }) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const cached = readCache(user?.id);
  const [owned, setOwned] = useState(cached?.owned || []);
  const [member, setMember] = useState(cached?.member || []);
  const resumeTick = useAppResume();

  const panelRef = useRef(null);
  const btnRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();

  /* ============================================================
     LOAD CLUBS
  ============================================================ */
  const { data: clubsResult, error: clubsError } = useSafeSupabaseFetch(
      async (session) => {
        const resolvedUserId = user?.id || session?.user?.id;
        if (!resolvedUserId) throw new Error("no-user");

        // Owned (president)
        const { data: ownedRows } = await supabase
          .from("club_members")
          .select("club_id, user_id, role, joined_at, accepted")
          .eq("user_id", resolvedUserId)
          .eq("role", "president");

        // Member (admin + member)
        const { data: memberRows } = await supabase
          .from("club_members")
          .select("club_id, user_id, role, joined_at, accepted")
          .eq("user_id", resolvedUserId)
          .in("role", ["admin", "member"]);

        const ownedIds = (ownedRows || []).map((r) => r.club_id).filter(Boolean);
        const memberIds = (memberRows || []).map((r) => r.club_id).filter(Boolean);
        const allIds = Array.from(new Set([...ownedIds, ...memberIds]));
        let clubsMap = {};
        if (allIds.length) {
          const { data: clubsData } = await supabase
            .from("clubs_public")
            .select("id, name, slug, profile_image_url")
            .in("id", allIds);
          clubsMap = (clubsData || []).reduce((acc, c) => {
            acc[c.id] = c;
            return acc;
          }, {});
        }

        const ownedClubs = ownedIds
          .map((id) => clubsMap[id] || { id, name: "Club", slug: null })
          .filter((c) => c.id);
        const memberClubs = memberIds
          .map((id) => clubsMap[id] || { id, name: "Club", slug: null })
          .filter((c) => c.id);

        return { owned: ownedClubs, member: memberClubs, userId: resolvedUserId };
      },
      [user?.id, resumeTick],
      { enabled: true, timeoutMs: 8000, initialData: null }
    );

  useEffect(() => {
    if (!clubsResult) return;
    setOwned(clubsResult.owned || []);
    setMember(clubsResult.member || []);
    writeCache(clubsResult.userId, {
      owned: clubsResult.owned || [],
      member: clubsResult.member || [],
    });
  }, [clubsResult]);

  useEffect(() => {
    if (clubsError && clubsError.message !== "no-user") {
      setOwned([]);
      setMember([]);
    }
  }, [clubsError]);


  // CLOSE ON OUTSIDE CLICK (native)
  useEffect(() => {
    function handleDocClick(e) {
      if (!panelRef.current || !btnRef.current) return;

      const clickedInsidePanel = panelRef.current.contains(e.target);
      const clickedButton = btnRef.current.contains(e.target);

      if (!clickedInsidePanel && !clickedButton) {
        setOpen(false);
      }
    }

    document.addEventListener("click", handleDocClick);
    return () => {
      document.removeEventListener("click", handleDocClick);
    };
  }, []);

  /* ============================================================
     CLOSE DROPDOWN ON ROUTE CHANGE
  ============================================================ */
  useEffect(() => {
    // smooth close AFTER navigation has triggered
    requestAnimationFrame(() => setOpen(false));
  }, [location.pathname]);

  if (!user) return null;

  /* ============================================================
     UI
  ============================================================ */
  return (
    <div className={`relative ${className}`}>
      {/* Toggle Button */}
      <button
        ref={btnRef}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-1.5 text-sm text-white hover:bg-zinc-900"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>Clubs</span>
        <ChevronDown className="h-4 w-4 opacity-70" />
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-80 rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl"
        >
          {/* ----------- Owned ----------- */}
          <Section title="Owned">
            {owned.length === 0 ? (
              <EmptyRow text="You don’t own a club yet." />
            ) : (
              owned.map((c) => (
                <Row
                  key={c.id}
                  title={c.name}
                  img={c.profile_image_url}
                  slug={c.slug}
                  id={c.id}
                  navigate={navigate}
                  setOpen={setOpen}
                  badge={<Crown className="h-3.5 w-3.5 text-yellow-400" />}
                />
              ))
            )}
          </Section>

          {/* ----------- Member ----------- */}
          <Section title="Member">
            {member.length === 0 ? (
              <EmptyRow text="You haven’t joined any clubs yet." />
            ) : (
              member.map((c) => (
                <Row
                  key={c.id}
                  title={c.name}
                  img={c.profile_image_url}
                  slug={c.slug}
                  id={c.id}
                  navigate={navigate}
                  setOpen={setOpen}
                />
              ))
            )}
          </Section>

          {/* ----------- Footer ----------- */}
          <div className="flex items-center justify-between border-t border-white/10 p-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();       // ignore global listener
                navigate("/create-club");  // fire navigation immediately
                requestAnimationFrame(() => setOpen(false)); // smooth close
              }}
              className="rounded-lg px-2 py-1 text-xs font-medium text-yellow-400 hover:bg-yellow-400/10"
            >
              + Create Club
            </button>

            <Link
              to="/me/clubs"
              className="rounded-lg px-2 py-1 text-xs text-zinc-300 hover:bg-white/5"
            >
              View all…
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   SECTION
============================================================ */
function Section({ title, children }) {
  return (
    <div className="p-2">
      <div className="px-2 pb-1 text-[11px] uppercase tracking-wide text-zinc-500">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

/* ============================================================
   ROW
============================================================ */
function Row({ title, img, badge, slug, id, navigate, setOpen }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef(null);
  const imageSrc = img || "/default-avatar.svg";

  useEffect(() => {
    function onClick(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const clubPath = `/clubs/${slug || id}`;

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => {
          navigate(clubPath);
          requestAnimationFrame(() => setOpen(false));
        }}
        role="button"
        tabIndex={0}
        className="flex w-full items-center gap-3 rounded-xl p-2 hover:bg-white/5 cursor-pointer"
      >
        <div className="h-8 w-8 overflow-hidden rounded-lg border border-white/10 bg-zinc-800">
          <img
            src={imageSrc}
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/default-avatar.svg";
            }}
          />
        </div>
        <div className="flex-1 text-left text-sm text-white truncate">
          {title}
        </div>
        {badge ? <div className="text-yellow-400">{badge}</div> : null}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="ml-1 rounded-md px-2 py-1 text-xs text-zinc-300 hover:bg-white/5"
        >
          ⋯
        </button>
      </div>

      {menuOpen && (
        <div className="absolute right-0 mt-1 w-40 rounded-lg bg-zinc-900 border border-white/10 shadow-xl z-50">
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm hover:bg-white/5"
            onClick={() => {
              setMenuOpen(false);
              navigate(clubPath);
              requestAnimationFrame(() => setOpen(false));
            }}
          >
            Open club
          </button>

          <Link
            to={`${clubPath}/leave`}
            className="block w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
            onClick={() => {
              setMenuOpen(false);
              requestAnimationFrame(() => setOpen(false));
            }}
          >
            Leave club
          </Link>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   EMPTY ROW
============================================================ */
function EmptyRow({ text }) {
  return <div className="px-2 py-2 text-xs text-zinc-500">{text}</div>;
}
