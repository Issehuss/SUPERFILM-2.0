// src/supabaseClient.js
import { createClient } from "@supabase/supabase-js";
import { env } from "./lib/env";

if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
  console.error("[supabaseClient] Missing Supabase env vars. Check .env(.local).", {
    url: env.SUPABASE_URL,
    anonPrefix: env.SUPABASE_ANON_KEY?.slice(0, 8) || null,
  });
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
  global: { headers: { "x-client-info": "superfilm-web" } },
});

export default supabase;
