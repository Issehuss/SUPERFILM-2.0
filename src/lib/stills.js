import supabase from "lib/supabaseClient";

export async function searchStills(query) {
  if (!query?.trim()) return { data: [], error: null };
  // Make sure this name matches your deployed function!
  return await supabase.functions.invoke("search-stills", { body: { q: query } });
}
