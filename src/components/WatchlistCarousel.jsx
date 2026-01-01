// src/components/WatchlistCarousel.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import useWatchlist from "../hooks/useWatchlist";
import TmdbImage from "./TmdbImage";

export default function WatchlistCarousel({
  userId,
  movieRoute = "/movie",      // your route base
  intervalMs = 4000,          // auto-advance interval
  height = 260,               // poster area height
}) {
  const { items, loading } = useWatchlist(userId);
  const slides = useMemo(() => items ?? [], [items]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);
  const navigate = useNavigate();

  // Respect reduced motion
  const prefersReducedMotion = typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Auto-advance
  useEffect(() => {
    if (slides.length <= 1) return;
    if (paused || prefersReducedMotion) return;
    timerRef.current = setInterval(() => {
      setIdx((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [slides.length, intervalMs, paused, prefersReducedMotion]);

  // Keyboard nav
  useEffect(() => {
    const onKey = (e) => {
      if (!slides.length) return;
      if (e.key === "ArrowRight") setIdx((i) => (i + 1) % slides.length);
      if (e.key === "ArrowLeft") setIdx((i) => (i - 1 + slides.length) % slides.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-black/50 p-5 h-[260px] grid place-items-center">
        <div className="w-48 h-32 rounded-lg bg-zinc-800 animate-pulse" />
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-black/50 p-5 h-[260px] grid place-items-center text-zinc-400">
        Your watchlist is empty.
      </div>
    );
  }

  const current = slides[idx];
  const id = current?.id ?? current?.movie_id;
  const title = current?.title || "";
  const poster = current?.poster_path
    ? (current.poster_path.startsWith("http")
        ? current.poster_path
        : `https://image.tmdb.org/t/p/w780${current.poster_path}`)
    : "";

  const go = () => {
    if (!id) return;
    navigate(`${movieRoute}/${id}`);
  };

  return (
    <div
      className="relative rounded-2xl border border-zinc-800 bg-black/50 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      style={{ height }}
    >
      {/* Slide area */}
      <button
        onClick={go}
        className="w-full h-full flex items-center justify-center focus:outline-none group"
        title={title}
        aria-label={title ? `Open ${title}` : "Open movie"}
      >
        {poster ? (
          <TmdbImage
            src={poster}
            alt={title || "Poster"}
            className="h-full w-full"
            imgClassName="transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full grid place-items-center text-sm text-zinc-400">
            No image
          </div>
        )}
      </button>

      {/* Gradient footer + title */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="text-sm font-medium line-clamp-1">{title}</div>
      </div>

      {/* Dots */}
      <div className="absolute bottom-2 right-3 flex gap-1">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 w-1.5 rounded-full transition ${
              i === idx ? "bg-white" : "bg-white/30"
            }`}
          />
        ))}
      </div>

      {/* Prev/Next hit areas (subtle) */}
      {slides.length > 1 && (
        <>
          <button
            className="absolute left-0 top-0 bottom-0 w-10 hover:bg-white/5"
            onClick={() => setIdx((i) => (i - 1 + slides.length) % slides.length)}
            aria-label="Previous"
          />
          <button
            className="absolute right-0 top-0 bottom-0 w-10 hover:bg-white/5"
            onClick={() => setIdx((i) => (i + 1) % slides.length)}
            aria-label="Next"
          />
        </>
      )}
    </div>
  );
}
