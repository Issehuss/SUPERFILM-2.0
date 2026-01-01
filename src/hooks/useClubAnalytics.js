// src/hooks/useClubAnalytics.js
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import supabase from "../supabaseClient";
import {
  fetchKpis,
  fetchSeries,
  fetchEventFunnel,
  fetchHeatmap,
  fetchTopContent,
} from "../lib/analyticsApi";

const UUID_RE = /^[0-9a-f-]{16,}$/i;

/**
 * useClubAnalytics
 * @param {Object} params
 * @param {string} params.clubParam - club slug or uuid (from route)
 * @param {number} params.year - calendar year (e.g. 2025)
 */
export default function useClubAnalytics({ clubParam, year }) {
  const [clubId, setClubId] = useState(null);

  // data
  const [kpis, setKpis] = useState(null);
  const [series, setSeries] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [topContent, setTopContent] = useState([]);

  // state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const abortRef = useRef({ cancelled: false });

  // ---- compute annual window for this year ----
  const { from, to } = useMemo(() => {
    const y = Number(year) || new Date().getFullYear();
    const fromDate = new Date(Date.UTC(y, 0, 1, 0, 0, 0));      // Jan 1, 00:00 UTC
    const toDate = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0));    // Jan 1 next year
    return { from: fromDate, to: toDate };
  }, [year]);

  /** Resolve slug → id (or accept UUID as-is) */
  useEffect(() => {
    abortRef.current.cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        if (!clubParam) {
          setClubId(null);
          return;
        }

        if (UUID_RE.test(clubParam)) {
          setClubId(clubParam);
          return;
        }

        const { data, error } = await supabase
          .from("clubs")
          .select("id")
          .eq("slug", clubParam)
          .maybeSingle();

        if (error) throw error;
        setClubId(data?.id || null);
      } catch (e) {
        setError(e);
        setClubId(null);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      abortRef.current.cancelled = true;
    };
  }, [clubParam]);

  const doFetch = useCallback(
    async (id) => {
      if (!id) return;

      setLoading(true);
      setError(null);
      abortRef.current.cancelled = false;

      try {
        const [k, s, f, h, t] = await Promise.all([
          fetchKpis(id, from, to),
          fetchSeries(id, from, to),
          fetchEventFunnel(id, from, to),
          fetchHeatmap(id, from, to),
          fetchTopContent(id, from, to, 20),
        ]);

        if (abortRef.current.cancelled) return;

        setKpis(k || null);
        setSeries(Array.isArray(s) ? s : []);
        setFunnel(Array.isArray(f) ? f : []);
        setHeatmap(Array.isArray(h) ? h : []);
        setTopContent(Array.isArray(t) ? t : []);
      } catch (e) {
        if (!abortRef.current.cancelled) setError(e);
      } finally {
        if (!abortRef.current.cancelled) setLoading(false);
      }
    },
    [from, to]
  );

  /** Fetch when clubId or year window changes */
  useEffect(() => {
    if (!clubId) return;
    abortRef.current.cancelled = false;
    doFetch(clubId);
    return () => {
      abortRef.current.cancelled = true;
    };
  }, [clubId, doFetch]);

  /** Public refresh */
  const refresh = useCallback(() => {
    if (clubId) doFetch(clubId);
  }, [clubId, doFetch]);

  return {
    // ids/time
    clubId,
    from,
    to,
    year,

    // data
    kpis,
    series,
    funnel,
    heatmap,
    topContent,

    // state
    loading,
    error,

    // actions
    refresh,
  };
}
