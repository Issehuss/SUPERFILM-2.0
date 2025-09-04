// src/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

console.log("[supabaseClient] URL is:", url);
console.log("[supabaseClient] Key present?", !!anonKey);

if (!url || !anonKey) {
  console.warn("[supabaseClient] Missing REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY.");
}

const supabase = createClient(url, anonKey);

// Optional: expose for quick console checks
if (typeof window !== "undefined") window.supabase = supabase;

export default supabase;

