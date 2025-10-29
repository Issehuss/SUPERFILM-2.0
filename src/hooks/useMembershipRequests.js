// src/hooks/useMembershipRequests.js
import { useEffect, useState, useCallback } from "react";
import supabase from "../supabaseClient";

export default function useMembershipRequests(clubId, { status = "pending" } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("membership_requests")
      .select(`
        id,
        user_id,
        club_id,
        note,
        status,
        created_at,
        profiles:profiles!inner (
          id, slug, display_name, avatar_url
        )
      `)
      .eq("club_id", clubId)
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (!error) setRows(data || []);
    setLoading(false);
  }, [clubId, status]);

  useEffect(() => { refresh(); }, [refresh]);

  return { rows, loading, refresh };
}
