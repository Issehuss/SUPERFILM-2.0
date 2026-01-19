import { useCallback, useEffect, useRef, useState } from "react";
import supabase from "../supabaseClient";

/**
 * useSafeSupabaseFetch
 * - resolves session inside fetch
 * - retries when session is transiently null
 * - adds timeout failsafe + optional auto retry
 */
export default function useSafeSupabaseFetch(fetcher, deps = [], options = {}) {
  const {
    enabled = true,
    retryDelayMs = 400,
    timeoutMs = 8000,
    autoRetryOnTimeout = true,
    initialData = null,
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const [timedOut, setTimedOut] = useState(false);

  const retryTimerRef = useRef(null);
  const timeoutRef = useRef(null);
  const cancelledRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const run = useCallback(async () => {
    if (!enabled) return;
    clearTimers();
    setLoading(true);
    setTimedOut(false);
    setError(null);

    timeoutRef.current = setTimeout(() => {
      if (cancelledRef.current) return;
      setTimedOut(true);
      setLoading(false);
      if (autoRetryOnTimeout) {
        retryTimerRef.current = setTimeout(run, retryDelayMs);
      }
    }, timeoutMs);

    const { data: auth } = await supabase.auth.getSession();
    const session = auth?.session || null;
    if (!session) {
      clearTimers();
      if (!cancelledRef.current) {
        retryTimerRef.current = setTimeout(run, retryDelayMs);
      }
      return;
    }

    try {
      const result = await fetcher(session);
      if (!cancelledRef.current) {
        setData(result);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err);
      }
    } finally {
      clearTimers();
      if (!cancelledRef.current) setLoading(false);
    }
  }, [
    enabled,
    fetcher,
    retryDelayMs,
    timeoutMs,
    autoRetryOnTimeout,
    clearTimers,
  ]);

  useEffect(() => {
    cancelledRef.current = false;
    run();
    return () => {
      cancelledRef.current = true;
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, timedOut, retry: run };
}
