import { useEffect, useMemo, useState, useRef } from "react";
import { ChevronDown, Crown } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";

export default function ClubSwitcher({ className = "" }) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [owned, setOwned] = useState([]);
  const [member, setMember] = useState([]);
  const panelRef = useRef(null);
  const btnRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user?.id) return;
    let ignore = false;

    async function load() {
      // Owned (president)
      const { data: ownedRows } = await supabase
        .from("club_members")
        .select("role, clubs:club_id(id, name, slug, banner_url)")
        .eq("user_id", user.id)
        .eq("role", "president");

      const ownedClubs =
        ownedRows?.map(r => r.clubs).filter(Boolean) ?? [];

      // Member (admin/member)
      const { data: memberRows } = await supabase
        .from("club_members")
        .select("role, clubs:club_id(id, name, slug, banner_url)")
        .eq("user_id", user.id)
        .in("role", ["admin", "member"]);

      const memberClubs =
        memberRows?.map(r => r.clubs).filter(Boolean) ?? [];

      if (!ignore) {
        setOwned(ownedClubs);
        setMember(memberClubs);
      }
    }
    load();

    function onDocClick(e) {
      if (!panelRef.current || !btnRef.current) return;
      if (panelRef.current.contains(e.target) || btnRef.current.contains(e.target)) return;
      setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => {
      ignore = true;
      document.removeEventListener("click", onDocClick);
    };
  }, [user?.id]);

  // Close dropdown on route change
  useEffect(() => setOpen(false), [location.pathname]);

  if (!user) return null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/60 px-3 py-1.5 text-sm text-white hover:bg-zinc-900"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span>Clubs</span>
        <ChevronDown className="h-4 w-4 opacity-70" />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-80 rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl"
        >
          {/* Owned */}
          <Section title="Owned">
            {owned.length === 0 ? (
              <EmptyRow text="You don’t own a club yet." />
            ) : (
              owned.map(c => (
                <Row
                  key={c.id}
                  onClick={() => navigate(`/clubs/${c.slug || c.id}`)}
                  title={c.name}
                  badge={<Crown className="h-3.5 w-3.5" />}
                  img={c.banner_url}
                />
              ))
            )}
          </Section>

          {/* Member */}
          <Section title="Member">
            {member.length === 0 ? (
              <EmptyRow text="You haven’t joined any clubs yet." />
            ) : (
              member.map(c => (
                <Row
                  key={c.id}
                  onClick={() => navigate(`/clubs/${c.slug || c.id}`)}
                  title={c.name}
                  img={c.banner_url}
                />
              ))
            )}
          </Section>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-white/10 p-2">
            <Link
              to="/create-club"
              className="rounded-lg px-2 py-1 text-xs font-medium text-yellow-400 hover:bg-yellow-400/10"
            >
              + Create Club
            </Link>
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

function Section({ title, children }) {
  return (
    <div className="p-2">
      <div className="px-2 pb-1 text-[11px] uppercase tracking-wide text-zinc-500">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ title, img, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl p-2 hover:bg-white/5"
    >
      <div className="h-8 w-8 overflow-hidden rounded-lg border border-white/10 bg-zinc-800">
        {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : null}
      </div>
      <div className="flex-1 text-left text-sm text-white">{title}</div>
      {badge ? <div className="text-yellow-400">{badge}</div> : null}
    </button>
  );
}

function EmptyRow({ text }) {
  return (
    <div className="px-2 py-2 text-xs text-zinc-500">{text}</div>
  );
}
