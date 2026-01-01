// src/components/AuthGate.jsx
// Ensures Supabase session is hydrated before rendering the app.
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function AuthGate({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // If no session, just allow app to render (public routes still work); avoid reload loops
      if (!session) {
        setReady(true);
        return;
      }
      setReady(true);
    });

    // In case onAuthStateChange never fires, mark ready after a microtask
    const timer = setTimeout(() => setReady(true), 0);

    return () => {
      clearTimeout(timer);
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (!ready) return null; // could be a loader if desired
  return children;
}
