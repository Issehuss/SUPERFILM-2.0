// src/pages/PublicProfile.jsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import supabase from "../supabaseClient";
import UserProfile from "./UserProfile"; // reuse your viewer component

export default function PublicProfile() {
  const { slug } = useParams();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (on) {
        if (!error) setRow(data || null);
        setLoading(false);
      }
    })();
    return () => (on = false);
  }, [slug]);

  if (loading) return <div className="p-8 text-zinc-400">Loading…</div>;
  if (!row) return <div className="p-8 text-zinc-400">Profile not found.</div>;

  // UserProfile already renders from context; for public view, pass "profileOverride"
  return <UserProfile profileOverride={row} />;
}
