// src/pages/ProfileFollows.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import supabase from "lib/supabaseClient";
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

  const UUID_RX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  useEffect(() => {
    let cancelled = false;

    async function loadProfileAndFollows() {
      setLoading(true);
      setError("");
      try {
        await supabase.auth.getSession();
        const identifier = slug || id || user?.id;
        if (!identifier) {
          setError("No profile to load.");
          return;
        }

        // load profile by id OR slug/username (avoid invalid uuid errors)
        let profile = null;
        if (UUID_RX.test(String(identifier))) {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, display_name, slug, username, avatar_url")
            .eq("id", identifier)
            .maybeSingle();
          if (error) throw error;
          profile = data || null;
        } else {
          const { data: bySlug, error: slugErr } = await supabase
            .from("profiles")
            .select("id, display_name, slug, username, avatar_url")
            .eq("slug", String(identifier))
            .maybeSingle();
          if (slugErr) throw slugErr;
          profile = bySlug || null;

          if (!profile) {
            const { data: byUsername, error: userErr } = await supabase
              .from("profiles")
              .select("id, display_name, slug, username, avatar_url")
              .eq("username", String(identifier))
              .maybeSingle();
            if (userErr) throw userErr;
            profile = byUsername || null;
          }
        }

        if (!profile) {
          setError("Profile not found.");
          return;
        }
        if (!cancelled) setTargetProfile(profile);

        // load follows
        // fetch follow rows with ids
        let query = supabase
          .from("profile_follows")
          .select("follower_id, followee_id, created_at")
          .order("created_at", { ascending: false })
          .limit(50);

        if (modeKey === "following") {
          query = query.eq("follower_id", profile.id);
        } else {
          query = query.eq("followee_id", profile.id);
        }

        const { data, error: qErr } = await query;
        if (qErr) throw qErr;

        const ids =
          (data || []).map((r) => (modeKey === "following" ? r.followee_id : r.follower_id)).filter(Boolean);

        if (!ids.length) {
          if (!cancelled) setRows([]);
          return;
        }

        // fetch profiles for those ids
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("id, display_name, slug, username, avatar_url")
          .in("id", ids);
        if (pErr) throw pErr;

        // preserve order of ids; fall back to id-only rows if profile missing
        const profMap = new Map((profs || []).map((p) => [p.id, p]));
        const ordered = ids
          .map((id) => profMap.get(id) || { id });

        if (!cancelled) setRows(ordered);
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
        {!targetProfile && !loading && !error && (
          <p className="text-sm text-red-400 mb-6">Profile not found.</p>
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
                    src={p.avatar_url || "/default-avatar.svg"}
                    alt={p.display_name || handle}
                    className="w-10 h-10 rounded-full object-cover border border-white/10"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/default-avatar.svg";
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
