// src/supabaseClient.js
import { createClient } from "@supabase/supabase-js";
import { env } from "./lib/env";

if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  // Helpful error so it’s obvious if env vars are missing
  // eslint-disable-next-line no-console
  console.error("[supabaseClient] Missing Supabase env vars. Check .env(.local).", {
    SUPABASE_URL: !!env.SUPABASE_URL,
    SUPABASE_ANON_KEY: !!env.SUPABASE_ANON_KEY,
  });
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
export default supabase;
