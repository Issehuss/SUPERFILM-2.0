import { useCallback, useEffect, useRef, useState } from "react";
import isAbortError from "lib/isAbortError";

/**
 * useSafeSupabaseFetch
 * - runs the provided fetcher when `enabled` is true (auth/session should be resolved upstream)
 * - keeps the previous cache visible during background refreshes
 * - exposes a timeout/timedOut signal without kicking off automatic retries
 * - deduplicates inflight requests
 */
export default function useSafeSupabaseFetch(fetcher, deps = [], options = {}) {
  const {
    enabled = true,
    timeoutMs = 8000,
    initialData = null,
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(
    enabled && initialData == null
  );
  const [error, setError] = useState(null);
  const [timedOut, setTimedOut] = useState(false);

  const timeoutRef = useRef(null);
  const cancelledRef = useRef(false);
  const inFlightRef = useRef(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const run = useCallback(async () => {
    if (!enabled) return;
    if (inFlightRef.current) {
      return inFlightRef.current;
    }
    clearTimers();
    setTimedOut(false);
    setError(null);

    const hadNoData = data == null;
    if (hadNoData) {
      setLoading(true);
    }

    timeoutRef.current = setTimeout(() => {
      if (cancelledRef.current) return;
      setTimedOut(true);
      if (hadNoData) {
        setLoading(false);
      }
    }, timeoutMs);

    const promise = (async () => {
      try {
        const result = await fetcher();
        if (!cancelledRef.current) {
          setData(result);
        }
        return result;
      } catch (err) {
        if (!cancelledRef.current && !isAbortError(err)) {
          setError(err);
        }
        return undefined;
      } finally {
        clearTimers();
        inFlightRef.current = null;
        if (hadNoData && !cancelledRef.current) {
          setLoading(false);
        }
      }
    })();

    inFlightRef.current = promise;
    return promise;
  }, [enabled, fetcher, timeoutMs, clearTimers, data]);

  useEffect(() => {
    cancelledRef.current = false;
    if (enabled) {
      run();
    }
    return () => {
      cancelledRef.current = true;
      clearTimers();
      inFlightRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  return { data, loading, error, timedOut, retry: run };
}
