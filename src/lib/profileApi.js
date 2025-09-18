// src/lib/profileApi.js
import supabase from "../supabaseClient";

export async function ensureProfileRow(userId) {
  if (!userId) return;
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const { error: insErr } = await supabase.from("profiles").insert({ id: userId });
    if (insErr) throw insErr;
  }
}

export async function saveBasics(userId, patch) {
  await ensureProfileRow(userId);
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

export async function saveTasteAndFavs(userId, { taste_cards, favorite_films, use_glow_style, glow_preset }) {
  await ensureProfileRow(userId);
  const { error } = await supabase
    .from("profiles")
    .update({
      taste_cards: taste_cards ?? [],
      favorite_films: favorite_films ?? [],
      use_glow_style: typeof use_glow_style === "boolean" ? use_glow_style : true,
      glow_preset: glow_preset ?? null,
    })
    .eq("id", userId);
  if (error) throw error;
}

export async function saveBanner(userId, bannerUrl) {
  await ensureProfileRow(userId);
  const { error } = await supabase
    .from("profiles")
    .update({ banner_image: bannerUrl })
    .eq("id", userId);
  if (error) throw error;
}
