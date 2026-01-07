// src/pages/ProfileFollows.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import supabase from "../supabaseClient";
import { useUser } from "../context/UserContext";

export default function ProfileFollows() {
  const { slug, id, mode } = useParams();
  const { user } = useUser();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [targetProfile, setTargetProfile] = useState(null);
  const [error, setError] = useState("");

  const modeKey = (mode || "").toLowerCase() === "following" ? "following" : "followers";

  const heading = useMemo(
    () => (modeKey === "following" ? "Following" : "Followers"),
    [modeKey]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProfileAndFollows() {
      setLoading(true);
      setError("");
      try {
        const identifier = slug || id || user?.id;
        if (!identifier) {
          setError("No profile to load.");
          return;
        }

        // load profile by slug or id
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .or(`slug.eq.${identifier},id.eq.${identifier}`)
          .maybeSingle();
        if (!profile) {
          setError("Profile not found.");
          return;
        }
        if (!cancelled) setTargetProfile(profile);

        // load follows
        let query = supabase
          .from("profile_follows")
          .select("follower_id, followee_id, follower:follower_id(id, display_name, slug, username, avatar_url), followee:followee_id(id, display_name, slug, username, avatar_url)")
          .order("created_at", { ascending: false });

        if (modeKey === "following") {
          query = query.eq("follower_id", profile.id);
        } else {
          query = query.eq("followee_id", profile.id);
        }

        const { data, error: qErr } = await query;
        if (qErr) throw qErr;
        const mapped =
          data?.map((r) =>
            modeKey === "following" ? r.followee : r.follower
          )?.filter(Boolean) || [];
        if (!cancelled) setRows(mapped);
      } catch (e) {
        if (!cancelled) setError(e.message || "Unable to load follows.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfileAndFollows();
    return () => {
      cancelled = true;
    };
  }, [slug, id, user?.id, modeKey]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">{heading}</h1>
        {targetProfile && (
          <p className="text-sm text-zinc-400 mb-6">
            {targetProfile.display_name || targetProfile.username || targetProfile.slug || "User"}
          </p>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-sm text-red-400">{error}</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-zinc-400">No {heading.toLowerCase()} yet.</div>
        ) : (
          <ul className="space-y-3">
            {rows.map((p) => {
              const handle = p.slug || p.username || p.id;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-white/5 px-4 py-3"
                >
                  <img
                    src={p.avatar_url || "/avatars/default.jpg"}
                    alt={p.display_name || handle}
                    className="w-10 h-10 rounded-full object-cover border border-white/10"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/avatars/default.jpg";
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{p.display_name || handle}</div>
                    <div className="text-xs text-zinc-400 truncate">@{handle}</div>
                  </div>
                  <Link
                    to={`/u/${handle}`}
                    className="text-xs text-yellow-400 hover:underline"
                  >
                    View
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
