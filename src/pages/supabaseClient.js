import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./utils/env";

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_ANON_KEY = getEnv("SUPABASE_ANON_KEY");

if (!SUPABASE_URL) {
  throw new Error(
    "Missing Supabase URL. Set REACT_APP_SUPABASE_URL (CRA) or VITE_SUPABASE_URL (Vite)."
  );
}
if (!SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase anon key. Set REACT_APP_SUPABASE_ANON_KEY (CRA) or VITE_SUPABASE_ANON_KEY (Vite)."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export default supabase;
