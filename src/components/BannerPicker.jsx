import { useState } from "react";
import BannerCropper from "./BannerCropper";
import { FastAverageColor } from "fast-average-color";
import { getEnv } from "../utils/env";
import { useUser } from "../context/UserContext";
import supabase from "../supabaseClient";

const BUCKET = "banners"; // create this bucket in Supabase Storage

const BannerPicker = ({ onSelect }) => {
  const { user, saveProfilePatch } = useUser();
  const [query, setQuery] = useState("");
  const [backdrops, setBackdrops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bannerToCrop, setBannerToCrop] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  const TMDB_KEY = getEnv("TMDB_KEY") || getEnv("TMDB_API_KEY");

  async function tmdbSearchMovies(q, page = 1) {
    if (!TMDB_KEY || !q?.trim()) return { results: [] };
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&language=en-US&query=${encodeURIComponent(
      q
    )}&include_adult=false&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`);
    return res.json();
  }

  const handleSearch = async () => {
    if (!query.trim() || !TMDB_KEY) return;
    setLoading(true);
    try {
      const data = await tmdbSearchMovies(query);
      const images = (data?.results || [])
        .map((m) => m?.backdrop_path)
        .filter(Boolean)
        .slice(0, 10);
      setBackdrops(images);
    } catch (err) {
      console.error("Failed to fetch backdrops:", err);
      setBackdrops([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = async (path) => {
    const originalUrl = `https://image.tmdb.org/t/p/original${path}`;
    try {
      const res = await fetch(originalUrl);
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerToCrop(reader.result);
        setShowCropper(true);
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Failed to load image securely:", err);
    }
  };

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

  // Convert data URL -> Blob
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

  const handleCropComplete = async (croppedImage) => {
    try {
      const gradient = (await getGradientFromImage(croppedImage)) || "";
      if (!user) {
        // Not signed in: fallback to localStorage, still call onSelect for UI
        localStorage.setItem("userBanner", croppedImage);
        localStorage.setItem("userGradient", gradient);
        onSelect?.({ image: croppedImage, gradient });
        setShowCropper(false);
        setBannerToCrop(null);
        return;
      }

      // Upload to Storage + save to profiles
      const publicUrl = await uploadBannerToStorage(user.id, croppedImage);
      await saveProfilePatch({ banner_url: publicUrl, banner_gradient: gradient });

      onSelect?.({ image: publicUrl, gradient });
    } catch (e) {
      console.error("Failed to save banner:", e);
    } finally {
      setShowCropper(false);
      setBannerToCrop(null);
    }
  };

  const handleCancelCrop = () => {
    setShowCropper(false);
    setBannerToCrop(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

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
          disabled={!TMDB_KEY}
        />
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-yellow-400 text-black font-semibold rounded hover:bg-yellow-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!TMDB_KEY || loading}
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {!TMDB_KEY && (
        <p className="mt-3 text-xs text-red-400">
          Set <code>REACT_APP_TMDB_KEY</code> (CRA) or <code>VITE_TMDB_KEY</code> (Vite) in <code>.env.local</code>.
        </p>
      )}

      {loading && TMDB_KEY && <p className="mt-3 text-zinc-400">Searching backdrops...</p>}

      {!!backdrops.length && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {backdrops.map((path, index) => (
            <img
              key={`${path}-${index}`}
              src={`https://image.tmdb.org/t/p/w500${path}`}
              alt="Backdrop"
              className="rounded-lg cursor-pointer hover:opacity-80 transition"
              onClick={() => handleImageClick(path)}
              loading="lazy"
            />
          ))}
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
};

export default BannerPicker;
