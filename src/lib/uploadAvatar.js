// src/lib/uploadAvatar.js
import supabase from "../supabaseClient";

const AVATAR_BUCKET = "club-avatars";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Upload a new avatar for a user and persist the public URL in profiles.avatar_url.
 * Optionally removes the previous avatar file if it belongs to the same bucket/folder.
 *
 * @param {File|Blob} file - Image file from <input type="file" />
 * @param {string} userId - The authenticated user's UUID
 * @param {object} [opts]
 * @param {string|null} [opts.prevUrl] - Existing avatar_url (to clean up)
 * @returns {Promise<string>} public URL of the uploaded avatar
 */
export default async function uploadAvatar(file, userId, opts = {}) {
  if (!file) throw new Error("No file provided.");
  if (!userId) throw new Error("No user id provided.");

  // Basic validation
  if (file.size > MAX_BYTES) {
    throw new Error("File too large. Max 5MB.");
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Unsupported file type. Use JPG, PNG, WEBP, or GIF.");
  }

  // Compose a safe storage path: <uid>/<timestamp>-<safe-name>.<ext>
  const original = (file.name || "avatar").toLowerCase();
  const ext = original.includes(".") ? original.split(".").pop() : mimeToExt(file.type) || "jpg";
  const safeBase = original.replace(/\.[^.]+$/, "").replace(/[^a-z0-9-_]+/g, "-").slice(0, 40) || "avatar";
  const path = `${userId}/${Date.now()}-${safeBase}.${ext}`;

  // Upload to Storage
  const { error: upErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) throw upErr;

  // Get a public URL
  const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const publicUrl = pub?.publicUrl;
  if (!publicUrl) throw new Error("Could not get public URL for avatar.");

  // Persist in profiles
  const { error: dbErr } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", userId);
  if (dbErr) {
    // Best-effort cleanup of the just-uploaded file if DB update fails
    try { await supabase.storage.from(AVATAR_BUCKET).remove([path]); } catch {}
    throw dbErr;
  }

  // Optional: remove previous avatar file if it was in the same bucket and under this user folder
  if (opts.prevUrl) {
    const prevPath = extractPathFromPublicUrl(opts.prevUrl, AVATAR_BUCKET);
    const belongsToUser = prevPath && prevPath.startsWith(`${userId}/`);
    if (belongsToUser) {
      try { await supabase.storage.from(AVATAR_BUCKET).remove([prevPath]); } catch {}
    }
  }

  return publicUrl;
}

/** Map common image MIME types to extensions */
function mimeToExt(mime) {
  switch (mime) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    default: return null;
  }
}

/**
 * Extract "<path>" from:
 * https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 */
function extractPathFromPublicUrl(url, bucket) {
  if (!url || !bucket) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length);
}

