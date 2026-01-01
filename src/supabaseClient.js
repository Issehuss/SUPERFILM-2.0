// src/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

/* -------------------------------------------------------------------------- */
/*                       ENVIRONMENT VARIABLE SAFETY CHECK                    */
/* -------------------------------------------------------------------------- */

// Load env vars
let supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const functionsUrl = process.env.REACT_APP_SUPABASE_FUNCTIONS_URL;

// 1. Ensure URL exists
if (!supabaseUrl) {
  console.error(
    "[SF ERROR] Missing REACT_APP_SUPABASE_URL. Check your .env.local file!"
  );
}

// 2. Ensure ANON KEY exists
if (!supabaseAnonKey) {
  console.error(
    "[SF ERROR] Missing REACT_APP_SUPABASE_ANON_KEY. Check your .env.local file!"
  );
}

// 3. Always force HTTPS (prevent http:// issues)
if (supabaseUrl?.startsWith("http://")) {
  supabaseUrl = supabaseUrl.replace("http://", "https://");
}

/* -------------------------------------------------------------------------- */
/*                           Supabase Client Options                           */
/* -------------------------------------------------------------------------- */

const options = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      "x-client-info": "superfilm-web",
    },
  },
};

// Attach functions URL if provided
if (functionsUrl) {
  options.functions = { url: functionsUrl };
}

/* -------------------------------------------------------------------------- */
/*                         CREATE THE SUPABASE CLIENT                          */
/* -------------------------------------------------------------------------- */

export const supabase = createClient(supabaseUrl, supabaseAnonKey, options);
export default supabase;

/* -------------------------------------------------------------------------- */
/*                        DEV MODE DEBUGGING HELPERS                           */
/* -------------------------------------------------------------------------- */

if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.log("[SF] ENV CHECK →", {
    url: supabaseUrl,
    anon: supabaseAnonKey?.slice(0, 10) + "...",
    functionsUrl,
  });

  // Expose client on window for debugging
  window.supabase = supabase;
}
