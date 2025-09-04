// src/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// After: const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
try {
    const payload = JSON.parse(atob((anonKey || '').split('.')[1] || ''));
    console.log('[supabaseClient] anonKey.ref =', payload?.ref);
  } catch (e) {
    console.warn('[supabaseClient] Could not decode anon key payload:', e?.message);
  }
  

if (!url || !anonKey) {
  console.warn("[supabaseClient] Missing REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY.");
}


const supabase = createClient(url, anonKey);

// Optional: expose for DevTools testing (window.supabase.auth.getUser())
if (typeof window !== "undefined") {
  window.supabase = supabase;
}

export default supabase;


