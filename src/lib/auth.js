// src/lib/auth.js
import supabase from "../supabaseClient";

export async function signOutUser() {
  // Sign out of Supabase (v2)
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
