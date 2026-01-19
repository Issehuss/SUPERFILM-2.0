// src/lib/ratingSchemes.js
import supabase from "../supabaseClient";

const RATING_SCHEME_SELECT = [
  "id",
  "profile_id",
  "name",
  "is_active",
  "tags",
  "updated_at",
  "created_at",
].join(", ");

/**
 * Tag shape (stored inside profile_rating_schemes.tags JSONB):
 * {
 *   id: string (uuid),
 *   label: string,
 *   emoji?: string,
 *   weight?: number (0.5 - 5.0),
 *   description?: string,
 *   category?: string,   // e.g. 'emotion' | 'tone' | ...
 *   order?: number       // 1..N
 * }
 */

function clampWeight(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 4.0;
  return Math.min(5, Math.max(0.5, Math.round(x * 2) / 2)); // step .5
}

function normalizeTag(raw, idx) {
  const t = raw || {};
  const out = {
    id: typeof t.id === "string" && t.id.length ? t.id : crypto.randomUUID(),
    label: String(t.label || "").trim().slice(0, 64),
    emoji: (t.emoji || "").toString().slice(0, 8) || undefined,
    weight: clampWeight(t.weight ?? 4.0),
    description: (t.description || "").toString().slice(0, 160) || undefined,
    category: (t.category || "emotion").toString().slice(0, 24),
    order: Number.isFinite(t.order) ? t.order : idx + 1,
  };
  // drop empty fields to keep JSON small
  Object.keys(out).forEach((k) => {
    if (out[k] === undefined || out[k] === null || out[k] === "") delete out[k];
  });
  return out;
}

function normalizeScheme(profileId, scheme) {
  const safeName = (scheme?.name || "My Rating Language").toString().slice(0, 64);
  const tags = Array.isArray(scheme?.tags) ? scheme.tags : [];
  const normalized = tags
    .map((t, i) => normalizeTag(t, i))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((t, i) => ({ ...t, order: i + 1 })); // re-index order

  return {
    id: scheme?.id || undefined, // let DB create uuid when missing
    profile_id: profileId,
    name: safeName,
    is_active: scheme?.is_active !== false, // default true
    tags: normalized,
  };
}

/**
 * Fetch the active scheme for a profile.
 * @returns {Promise<object|null>}
 */
export async function fetchActiveScheme(profileId) {
  if (!profileId) return null;
  const { data, error } = await supabase
    .from("profile_rating_schemes")
    .select(RATING_SCHEME_SELECT)
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.warn("[ratingSchemes] fetchActiveScheme:", error);
    throw error;
  }
  return data || null;
}

/**
 * List all schemes for a profile (active first).
 * @returns {Promise<object[]>}
 */
export async function listSchemes(profileId) {
  if (!profileId) return [];
  const { data, error } = await supabase
    .from("profile_rating_schemes")
    .select(RATING_SCHEME_SELECT)
    .eq("profile_id", profileId)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) {
    console.warn("[ratingSchemes] listSchemes:", error);
    throw error;
  }
  return data || [];
}

/**
 * Create or update a scheme. If created/updated with is_active=true,
 * it becomes the active scheme (and others are set inactive).
 * @returns {Promise<object>} saved row
 */
export async function upsertScheme(profileId, scheme) {
  if (!profileId) throw new Error("profileId required");
  const payload = normalizeScheme(profileId, scheme);

  const { data, error } = await supabase
    .from("profile_rating_schemes")
    .upsert(payload, { onConflict: "id" })
    .select(RATING_SCHEME_SELECT)
    .maybeSingle();

  if (error) {
    console.warn("[ratingSchemes] upsertScheme:", error);
    throw error;
  }

  // If this one is active, deactivate others
  if (data?.is_active) {
    await supabase
      .from("profile_rating_schemes")
      .update({ is_active: false })
      .eq("profile_id", profileId)
      .neq("id", data.id);
  }

  return data;
}

/**
 * Mark a scheme as active for the profile; others become inactive.
 * @returns {Promise<void>}
 */
export async function setActiveScheme(profileId, schemeId) {
  if (!profileId || !schemeId) throw new Error("profileId and schemeId required");

  const { error: e1 } = await supabase
    .from("profile_rating_schemes")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("id", schemeId)
    .eq("profile_id", profileId);

  if (e1) {
    console.warn("[ratingSchemes] setActiveScheme (activate):", e1);
    throw e1;
  }

  const { error: e2 } = await supabase
    .from("profile_rating_schemes")
    .update({ is_active: false })
    .eq("profile_id", profileId)
    .neq("id", schemeId);

  if (e2) {
    console.warn("[ratingSchemes] setActiveScheme (deactivate others):", e2);
    throw e2;
  }
}

/**
 * Delete a scheme by id (no-op if not found).
 * If it was active, you may want to set another scheme active afterwards.
 * @returns {Promise<void>}
 */
export async function deleteScheme(schemeId) {
  if (!schemeId) return;
  const { error } = await supabase
    .from("profile_rating_schemes")
    .delete()
    .eq("id", schemeId);

  if (error) {
    console.warn("[ratingSchemes] deleteScheme:", error);
    throw error;
  }
}

/**
 * Utility to quickly seed a basic scheme (useful in tests/dev).
 * @returns {Promise<object>} created scheme
 */
export async function seedBasicScheme(profileId) {
  const base = {
    name: "My Rating Language",
    is_active: true,
    tags: [
      { label: "Soft Masterpiece", emoji: "🌙", weight: 5, category: "tone" },
      { label: "Emotional Damage", emoji: "💔", weight: 4.5, category: "emotion" },
      { label: "Yearly Rewatch", emoji: "📆", weight: 4, category: "rewatch" },
      { label: "Form Over Feeling", emoji: "🧊", weight: 2.5, category: "critique" },
    ],
  };
  return upsertScheme(profileId, base);
}
