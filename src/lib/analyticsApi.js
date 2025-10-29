import supabase from "../supabaseClient";

const iso = (x) => (x instanceof Date ? x.toISOString() : x);

export async function fetchKpis(clubId, from, to) {
  const { data, error } = await supabase.rpc("rpc_analytics_kpis", {
    p_club: clubId,
    p_from: iso(from),
    p_to: iso(to),
  });
  if (error) throw error;
  return data?.[0] || null;
}

export async function fetchSeries(clubId, from, to) {
  const { data, error } = await supabase.rpc("rpc_analytics_engagement_series", {
    p_club: clubId,
    p_from: iso(from),
    p_to: iso(to),
  });
  if (error) throw error;
  return data || [];
}

export async function fetchEventFunnel(clubId, from, to) {
  const { data, error } = await supabase.rpc("rpc_analytics_event_funnel", {
    p_club: clubId,
    p_from: iso(from),
    p_to: iso(to),
  });
  if (error) throw error;
  return data || [];
}

export async function fetchHeatmap(clubId, from, to) {
  const { data, error } = await supabase.rpc("rpc_analytics_attendance_heatmap", {
    p_club: clubId,
    p_from: iso(from),
    p_to: iso(to),
  });
  if (error) throw error;
  return data || [];
}

export async function fetchTopContent(clubId, from, to, limit = 20) {
  const { data, error } = await supabase.rpc("rpc_analytics_top_content", {
    p_club: clubId,
    p_from: iso(from),
    p_to: iso(to),
    p_limit: limit,
  });
  if (error) throw error;
  return data || [];
}
