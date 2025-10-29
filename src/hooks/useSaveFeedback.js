// src/hooks/useSaveFeedback.js
import { useCallback, useRef, useState } from "react";

export default function useSaveFeedback({ successMs = 1800 } = {}) {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef(null);

  const withFeedback = useCallback(async (fn) => {
    if (saving) return;
    setSaving(true);
    setSuccess(false);
    setError("");
    clearTimeout(timerRef.current);
    try {
      await fn();
      setSuccess(true);
      timerRef.current = setTimeout(() => setSuccess(false), successMs);
    } catch (e) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }, [saving, successMs]);

  return { saving, success, error, withFeedback };
}
