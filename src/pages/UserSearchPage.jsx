// src/pages/UserSearchPage.jsx
import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import supabase from "../supabaseClient";
import { profileHref } from "../utils/profileHref";

function useQueryParam(name) {
  const { search } = useLocation();
  return new URLSearchParams(search).get(name) || "";
}

export default function UserSearchPage() {
  const q = useQueryParam("q");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchUsers() {
      if (!q.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, slug")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(30);

      setResults(data || []);
      setLoading(false);
    }

    fetchUsers();
  }, [q]);

  return (
    <div className="min-h-screen bg-black text-white px-6 py-8">
      <div className="max-w-3xl mx-auto">

        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          Search Users
        </h1>
        <p className="text-sm text-zinc-500 mb-6">
          Showing results for <span className="text-zinc-300">@{q}</span>
        </p>

        {loading && (
          <div className="text-sm text-zinc-400">Searching…</div>
        )}

        {!loading && results.length === 0 && (
          <div className="text-sm text-zinc-500">
            No users match <span className="text-zinc-300">@{q}</span>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {results.map((p) => (
            <UserSearchResultCard key={p.id} profile={p} />
          ))}
        </div>
      </div>
    </div>
  );
}

function UserSearchResultCard({ profile }) {
  const avatar = profile.avatar_url || "/default-avatar.svg";
  const displayName = profile.display_name || profile.username;
  const username = profile.username;

  return (
    <Link
      to={profileHref(profile)}
      className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 hover:border-yellow-400 hover:bg-zinc-900 transition-colors"
    >
      <div className="flex items-center gap-3">
        <img
          src={avatar}
          alt=""
          className="h-10 w-10 rounded-full object-cover border border-zinc-700"
        />
        <div>
          <div className="text-sm font-medium">{displayName}</div>
          <div className="text-xs text-zinc-500">@{username}</div>
        </div>
      </div>

      <div className="text-xs text-yellow-300">
        View profile →
      </div>
    </Link>
  );
}
