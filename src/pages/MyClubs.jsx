import { useEffect, useState, useMemo } from "react";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";
import { Link } from "react-router-dom";
import { Crown, Plus } from "lucide-react";

export default function MyClubs() {
  const { user } = useUser();
  const [owned, setOwned] = useState([]);
  const [member, setMember] = useState([]);

  useEffect(() => {
    if (!user?.id) return;
    let ignore = false;

    async function load() {
      const { data: o } = await supabase
        .from("club_members")
        .select("role, clubs:club_id(id, name, slug, banner_url)")
        .eq("user_id", user.id)
        .eq("role", "president");

      const { data: m } = await supabase
        .from("club_members")
        .select("role, clubs:club_id(id, name, slug, banner_url)")
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

  if (!user) {
    return <div className="p-6 text-zinc-400">Sign in to view your clubs.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">My Clubs</h1>
        <Link
          to="/create-club"
          className="flex items-center gap-2 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-1.5 text-sm font-medium text-yellow-400 hover:bg-yellow-500/15"
        >
          <Plus className="h-4 w-4" /> Create Club
        </Link>
      </div>

      <Section title="Owned">
        {owned.length === 0 ? (
          <EmptyCard
            title="You don’t own a club yet"
            ctaText="Create your first club"
            to="/create-club"
          />
        ) : (
          <CardGrid clubs={owned} owned />
        )}
      </Section>

      <Section title="Member">
        {member.length === 0 ? (
          <div className="text-sm text-zinc-400">Join clubs and they’ll appear here.</div>
        ) : (
          <CardGrid clubs={member} />
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-yellow-400">{title}</h2>
      {children}
    </section>
  );
}

function CardGrid({ clubs, owned }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {clubs.map(c => (
        <ClubCard key={c.id} club={c} owned={owned} />
      ))}
    </div>
  );
}

function ClubCard({ club, owned }) {
  return (
    <Link
      to={`/clubs/${club.slug || club.id}`}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 hover:border-white/20"
    >
      <div className="h-28 w-full bg-zinc-900">
        {club.banner_url ? (
          <img src={club.banner_url} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="flex items-center gap-2 p-3">
        <div className="flex-1 truncate text-sm font-medium text-white group-hover:text-yellow-300">
          {club.name}
        </div>
        {owned ? <Crown className="h-4 w-4 text-yellow-400" /> : null}
      </div>
    </Link>
  );
}

function EmptyCard({ title, ctaText, to }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950 p-4 text-sm text-zinc-300">
      <div className="mb-2">{title}</div>
      <Link to={to} className="text-yellow-400 hover:underline">
        + {ctaText}
      </Link>
    </div>
  );
}
