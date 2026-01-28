// src/lib/uploadAvatar.js
import supabase from "lib/supabaseClient";
import heic2any from "heic2any";

const AVATAR_BUCKET = "user-avatars";
const MAX_BYTES = 10 * 1024 * 1024;

// Formats Supabase supports without issues (after conversion)
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_EXTS = ["jpg", "jpeg", "png", "webp", "gif"];

const normalizeMime = (raw) => (raw ? String(raw).toLowerCase() : "");

const inferMimeFromName = (name) => {
  if (!name) return "";
  const ext = name.split(".").pop()?.toLowerCase();
  if (!ext) return "";
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "heic":
    case "heif":
      return "image/heic";
    default:
      return "";
  }
};

// HEIC binary signature detection
async function isHeicBinary(file) {
  try {
    const head = await file.slice(4, 12).arrayBuffer();
    const text = new TextDecoder().decode(head);
    return (
      text.startsWith("ftypheic") ||
      text.startsWith("ftypheix") ||
      text.startsWith("ftyphevc") ||
      text.startsWith("ftyphevx")
    );
  } catch {
    return false;
  }
}

// Sniff a likely image MIME from the first few bytes (fallback for blank/misreported types)
async function sniffMime(file) {
  try {
    const buf = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(buf);
    const str = (start, len) => String.fromCharCode(...bytes.slice(start, start + len));
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (str(0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
    if (str(0, 4) === "GIF8") return "image/gif";
    if (str(0, 4) === "RIFF" && str(8, 4) === "WEBP") return "image/webp";
    const brand = str(4, 8);
    if (brand.includes("ftypheic")) return "image/heic";
    if (brand.includes("ftypheif")) return "image/heif";
  } catch {
    // ignore
  }
  return "";
}

export default async function uploadAvatar(file, userId, opts = {}) {
  if (!file) throw new Error("No file provided.");
  if (!userId) throw new Error("No user id provided.");

  let rawMime =
    normalizeMime(file.type) ||
    inferMimeFromName(file.name) ||
    (await sniffMime(file)) ||
    "";

  // Debug log to confirm what we're receiving
  console.log("[Avatar] raw file.type =", file.type);
  console.log("[Avatar] inferred MIME =", rawMime);
  console.log("[Avatar] file.name =", file.name);

  // HEIC detection rules (bulletproof)
  const looksHeic =
    rawMime.includes("heic") ||
    rawMime.includes("heif") ||
    (file.name && file.name.toLowerCase().endsWith(".heic")) ||
    (file.name && file.name.toLowerCase().endsWith(".heif")) ||
    (file.type === "" && file.size > 200 * 1024) || // Safari quirk: blank MIME + photo-size → HEIC
    (await isHeicBinary(file)); // binary magic check

  console.log("[Avatar] looksHeic =", looksHeic);

  // Always convert HEIC → JPEG
  if (looksHeic) {
    try {
      const convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.9,
      });

      file = new File(
        [convertedBlob],
        (file.name || "avatar").replace(/\.[^.]+$/, ".jpg"),
        { type: "image/jpeg" }
      );

      rawMime = "image/jpeg";
    } catch (err) {
      console.error("HEIC conversion failed:", err);
      throw new Error("Could not process HEIC/HEIF image. Try another photo.");
    }
  }

  // Validate fully-converted file
  console.log("[Avatar] final MIME =", rawMime);

  if (file.size > MAX_BYTES) {
    throw new Error("File too large. Max 10MB.");
  }

  if (!ALLOWED_TYPES.includes(rawMime)) {
    // Last-chance sniff for common misreports (e.g., iOS returning text/html)
    const sniffed = await sniffMime(file);
    if (!sniffed || !ALLOWED_TYPES.includes(sniffed)) {
      console.error("[Avatar] REJECTED MIME:", rawMime, "file:", file);
      throw new Error("Unsupported file type. Use JPG, PNG, WEBP, or GIF.");
    }
    rawMime = sniffed;
  }

  // Final extension
  const original = (file.name || "avatar").toLowerCase();
  const extFromName = original.includes(".") ? original.split(".").pop() : "";
  const ext = ALLOWED_EXTS.includes(extFromName)
    ? extFromName
    : mimeToExt(rawMime) || "jpg";

  const safeBase =
    original
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9-_]+/g, "-")
      .slice(0, 40) || "avatar";

  const path = `${userId}/${Date.now()}-${safeBase}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: rawMime });

  if (upErr) {
    console.error("Supabase upload error:", upErr);
    throw new Error("Failed to upload avatar. Please try again.");
  }

  const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  const publicUrl = pub?.publicUrl;
  if (!publicUrl) throw new Error("Could not create avatar URL.");

  const { error: dbErr } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", userId);

  if (dbErr) {
    try {
      await supabase.storage.from(AVATAR_BUCKET).remove([path]);
    } catch {}
    throw new Error("Failed to save avatar. Please try again.");
  }

  // Cleanup old avatar
  if (opts.prevUrl) {
    const prevPath = extractPathFromPublicUrl(opts.prevUrl, AVATAR_BUCKET);
    if (prevPath && prevPath.startsWith(`${userId}/`)) {
      try {
        await supabase.storage.from(AVATAR_BUCKET).remove([prevPath]);
      } catch {}
    }
  }

  return publicUrl;
}

function mimeToExt(mime) {
  switch (mime) {
    case "image/jpeg": return "jpg";
    case "image/png": return "png";
    case "image/webp": return "webp";
    case "image/gif": return "gif";
    default: return "jpg";
  }
}

function extractPathFromPublicUrl(url, bucket) {
  if (!url || !bucket) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length);
}
