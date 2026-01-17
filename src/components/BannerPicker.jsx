// src/components/BannerPicker.jsx
import { useState } from "react";
import BannerCropper from "./BannerCropper";
import { FastAverageColor } from "fast-average-color";
import { useUser } from "../context/UserContext";
import supabase from "../supabaseClient";
import { searchMovies } from "../lib/tmdbClient";

const BUCKET = "banners"; // make sure this bucket exists in Supabase Storage

export default function BannerPicker({ onSelect }) {
  const { user, saveProfilePatch } = useUser();

  const [query, setQuery] = useState("");
  const [backdrops, setBackdrops] = useState([]); // [{ id, title, url }]
  const [loading, setLoading] = useState(false);

  const [bannerToCrop, setBannerToCrop] = useState(null); // data URL
  const [showCropper, setShowCropper] = useState(false);

  // --- Helpers ---------------------------------------------------------------

  // Convert TMDB CDN URL like .../w780/abc.jpg -> .../original/abc.jpg (better for cropping)
  function toOriginalSize(url) {
    if (!url) return url;
    return url.replace(/\/w\d+\//, "/original/");
  }

  async function fetchAsDataUrl(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const blob = await res.blob();
    const reader = new FileReader();
    return await new Promise((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  const getGradientFromImage = async (imageSrc) => {
    const fac = new FastAverageColor();
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = imageSrc;
      img.onload = () => {
        try {
          const color = fac.getColor(img).hex;
          resolve(`linear-gradient(to bottom, ${color}, #000000)`);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
    });
  };

  // dataURL -> Blob
  function dataURLtoBlob(dataUrl) {
    const [meta, data] = dataUrl.split(",");
    const mime = meta.match(/data:(.*);base64/)?.[1] || "image/jpeg";
    const binary = atob(data);
    const len = binary.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
    return new Blob([u8], { type: mime });
  }

  // Upload to Supabase Storage and return public URL
  async function uploadBannerToStorage(userId, dataUrl) {
    const blob = dataURLtoBlob(dataUrl);
    const filename = `banner_${Date.now()}.jpg`;
    const path = `${userId}/${filename}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
      cacheControl: "3600",
      upsert: true,
      contentType: blob.type || "image/jpeg",
    });
    if (upErr) throw upErr;

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return publicUrl;
  }

  // --- TMDB search (via secure proxy) ---------------------------------------

  async function handleSearch() {
    const term = query.trim();
    if (!term) {
      setBackdrops([]);
      return;
    }
    setLoading(true);
    try {
      const hits = await searchMovies(term); // normalized: { id, title, year, posterUrl, backdropUrl }
      const items = (hits || [])
        .map((h) => ({
          id: h.id,
          title: h.title,
          url: h.backdropUrl || h.posterUrl || "", // prefer backdrops for banners
        }))
        .filter((x) => !!x.url)
        .slice(0, 10);
      setBackdrops(items);
    } catch (err) {
      console.error("Failed to fetch backdrops:", err);
      setBackdrops([]);
    } finally {
      setLoading(false);
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  async function handleImageClick(item) {
    try {
      const originalUrl = toOriginalSize(item.url);
      const dataUrl = await fetchAsDataUrl(originalUrl);
      setBannerToCrop(dataUrl);
      setShowCropper(true);
    } catch (err) {
      console.error("Failed to load image:", err);
    }
  }

  async function handleCropComplete(croppedImage) {
    try {
      const gradient = (await getGradientFromImage(croppedImage)) || "";

      if (!user) {
        // Not signed in: store locally but still bubble up to UI
        localStorage.setItem("userBanner", croppedImage);
        localStorage.setItem("userGradient", gradient);
        onSelect?.({ image: croppedImage, gradient });
        setShowCropper(false);
        setBannerToCrop(null);
        return;
      }

      const publicUrl = await uploadBannerToStorage(user.id, croppedImage);
      await saveProfilePatch?.({ banner_url: publicUrl, banner_gradient: gradient });

      onSelect?.({ image: publicUrl, gradient });
    } catch (e) {
      console.error("Failed to save banner:", e);
    } finally {
      setShowCropper(false);
      setBannerToCrop(null);
    }
  }

  const handleCancelCrop = () => {
    setShowCropper(false);
    setBannerToCrop(null);
  };

  // --- UI --------------------------------------------------------------------

  return (
    <div className="mt-6 bg-zinc-900 p-4 rounded-md shadow">
      <h3 className="text-lg font-semibold mb-2">Search for a Banner Image</h3>

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-2 rounded bg-zinc-800 text-white border border-zinc-700 focus:outline-none"
          placeholder="Enter film name..."
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-yellow-400 text-black font-semibold rounded hover:bg-yellow-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {loading && <p className="mt-3 text-zinc-400">Searching backdrops...</p>}

      {!!backdrops.length && (
        <div className="mt-4 max-h-64 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {backdrops.map((item) => (
              <img
                key={item.id + "_" + item.url}
                src={item.url.replace("/original/", "/w500/")} // lighter thumbs in the grid
                alt={item.title || "Backdrop"}
                className="rounded-lg cursor-pointer hover:opacity-80 transition"
                onClick={() => handleImageClick(item)}
                loading="lazy"
              />
            ))}
          </div>
        </div>
      )}

      {showCropper && bannerToCrop && (
        <BannerCropper
          imageSrc={bannerToCrop}
          onCancel={handleCancelCrop}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}
