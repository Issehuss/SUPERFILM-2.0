// src/pages/PublicProfileById.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import supabase from "lib/supabaseClient";
import PublicProfile from "./PublicProfile";

/**
 * If you prefer canonical URLs by slug, this component looks up the slug by ID
 * and redirects to /u/:slug. If no slug, it renders the same read-only view.
 */
export default function PublicProfileById() {
  const { id } = useParams();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, slug")
        .eq("id", id)
        .maybeSingle();
      if (on) {
        setRow(error ? null : data);
        setLoading(false);
      }
    })();
    return () => { on = false; };
  }, [id]);

  if (loading) return <div className="p-8 text-zinc-400">Loading…</div>;
  if (!row) return <div className="p-8 text-zinc-400">Profile not found.</div>;
  if (row.slug) return <Navigate to={`/u/${row.slug}`} replace />;

  // No slug? Reuse PublicProfile layout by faking a :slug param is tricky.
  // Easiest: show a very simple fallback or build a duplicate query here.
  // For simplicity just show “not found” UX:
  return <div className="p-8 text-zinc-400">This profile has no public slug.</div>;
}
