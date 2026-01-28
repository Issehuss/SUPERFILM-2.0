import { useEffect, useMemo, useRef, useState } from "react";
import useSafeSupabaseFetch from "./useSafeSupabaseFetch";

export default function useHydratedSupabaseFetch(fetcher, deps = [], opts = {}) {
  const {
    sessionLoaded,
    userId,
    timeoutMs = 8000,
    initialData = null,
    enabled = true,
    refreshEpoch = 0,
  } = opts;

  const [fetchEpoch, setFetchEpoch] = useState(0);
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    if (!sessionLoaded) return;
    setFetchEpoch((prev) => prev + 1);
  }, [sessionLoaded]);

  const refreshEpochRef = useRef(refreshEpoch);
  useEffect(() => {
    if (!sessionLoaded) return;
    if (refreshEpoch === refreshEpochRef.current) return;
    refreshEpochRef.current = refreshEpoch;
    setFetchEpoch((prev) => prev + 1);
  }, [refreshEpoch, sessionLoaded]);

  const finalEnabled =
    Boolean(enabled && sessionLoaded) && (userId == null || Boolean(userId));
  const finalDeps = useMemo(() => [fetchEpoch, ...(deps || [])], [fetchEpoch, deps]);

  const result = useSafeSupabaseFetch(fetcher, finalDeps, {
    enabled: finalEnabled,
    timeoutMs,
    initialData,
  });

  useEffect(() => {
    if (result?.data !== undefined && result?.data !== null) {
      hasHydratedRef.current = true;
    }
  }, [result?.data]);

  return {
    ...result,
    fetchEpoch,
    hasHydrated: hasHydratedRef.current,
    showSkeleton: Boolean(result?.loading && !hasHydratedRef.current),
  };
}
