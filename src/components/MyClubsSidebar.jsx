import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";
import { Crown } from "lucide-react";

export default function MyClubsSidebar({ className = "" }) {
  const { user } = useUser();
  const [owned, setOwned] = useState([]);
  const [member, setMember] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    let ignore = false;

    async function load() {
      const { data: o } = await supabase
        .from("club_members")
        .select("role, clubs:club_id(id, name, slug)")
        .eq("user_id", user.id)
        .eq("role", "president");
      const { data: m } = await supabase
        .from("club_members")
        .select("role, clubs:club_id(id, name, slug)")
        .eq("user_id", user.id)
        .in("role", ["admin", "member"]);
      if (!ignore) {
        setOwned((o ?? []).map(r => r.clubs).filter(Boolean));
        setMember((m ?? []).map(r => r.clubs).filter(Boolean));
      }
    }
    load();
    return () => { ignore = true; };
  }, [user?.id]);

  if (!user) return null;

  return (
    <aside className={`hidden md:block ${className}`}>
      <div className="rounded-2xl border border-white/10 bg-zinc-950 p-3">
        <h3 className="mb-2 px-1 text-sm font-semibold text-yellow-400">My Clubs</h3>

        <Section title="Owned">
          {owned.length === 0 ? (
            <Empty text="Start your first club" to="/create-club" />
          ) : (
            owned.slice(0, 6).map(c => (
              <LinkRow key={c.id} to={`/clubs/${c.slug || c.id}`} title={c.name} owned />
            ))
          )}
        </Section>

        <Section title="Member">
          {member.length === 0 ? (
            <div className="px-2 py-1 text-xs text-zinc-500">Join a club to see it here.</div>
          ) : (
            member.slice(0, 6).map(c => (
              <LinkRow key={c.id} to={`/clubs/${c.slug || c.id}`} title={c.name} />
            ))
          )}
        </Section>

        <div className="mt-2 px-1">
          <Link to="/me/clubs" className="text-xs text-zinc-300 hover:underline">
            See all →
          </Link>
        </div>
      </div>
    </aside>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-2">
      <div className="px-1 pb-1 text-[11px] uppercase tracking-wide text-zinc-500">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function LinkRow({ to, title, owned }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-white hover:bg-white/5"
    >
      <span className="truncate">{title}</span>
      {owned ? <Crown className="ml-auto h-3.5 w-3.5 text-yellow-400" /> : null}
    </Link>
  );
}
function Empty({ text, to }) {
  return (
    <Link to={to} className="block rounded-lg px-2 py-1.5 text-xs text-yellow-400 hover:bg-yellow-400/10">
      + {text}
    </Link>
  );
}
