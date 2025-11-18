// src/supabaseClient.js
import { createClient } from "@supabase/supabase-js";
import { env } from "./lib/env";

/**
 * Create a single supabase-js v2 client for the app.
 * - If SUPABASE_FUNCTIONS_URL is set, Functions will use that origin.
 *   (Otherwise they default to `${SUPABASE_URL}/functions/v1`.)
 * - Auth session is persisted and auto-refreshed.
 * - A tiny client header to help trace requests in logs.
 */
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

// Optional override for Functions host (useful for custom domain / edge region)
if (env.SUPABASE_FUNCTIONS_URL) {
  options.functions = { url: env.SUPABASE_FUNCTIONS_URL };
}


const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, options);

export default supabase;
