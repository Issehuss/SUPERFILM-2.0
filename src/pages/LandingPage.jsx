// src/pages/LandingPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const carouselSlides = [
  {
    heading: "Your film community lives here.",
    subheading: "Find your taste. Build your club. Share the experience.",
    image: "/decision_to_leave.jpg",
  },
  {
    heading: "Join local and online film circles.",
    subheading: "Meet others who share your cinematic tastes.",
    image: "/taste_cherry.jpg",
  },
  {
    heading: "Curate and host film screenings.",
    subheading: "Turn any night into a cinematic event.",
    image: "/rye_lane.jpg",
  },
  {
    heading: "Craft your profile through films.",
    subheading: "Taste Cards and Favorites speak louder than words.",
    image: "/worst_person.jpg",
  },
];

export default function LandingPage() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % carouselSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const { heading, subheading, image } = carouselSlides[index];

  return (
    <div
      className="
        relative w-full h-[calc(100vh-120px)] overflow-hidden flex items-center justify-center text-white
        bg-black
      "
    >
      {/* ✅ Full-bleed background image with SIDE FADE mask */}
      <img
        src={image}
        alt="Background Still"
        className="absolute inset-0 w-full h-full object-cover object-center z-0"
        style={{
          // Slightly wider fade to avoid any edge banding
          WebkitMaskImage:
            'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
          maskImage:
            'linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)',
        }}
      />

      {/* ♻️ Gentle side fades (fallback for older browsers). Very soft so no visible seam */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[10vw] bg-gradient-to-r from-black/0 via-black/40 to-transparent z-0" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[10vw] bg-gradient-to-l from-black/0 via-black/40 to-transparent z-0" />

      {/* ✅ Darken for legibility */}
      <div className="absolute inset-0 bg-black/35 z-0" />

      {/* ✅ Vignette that now fades to TRANSPARENT at edges (no hard box) */}
      <div
        aria-hidden
        className="
          pointer-events-none absolute inset-0 z-0
          [background:
            radial-gradient(120%_80%_at_50%_40%,
              rgba(0,0,0,0) 0%,
              rgba(0,0,0,0.55) 62%,
              rgba(0,0,0,0.18) 80%,
              rgba(0,0,0,0) 100%
            )
          ]
        "
      />

      {/* ✅ Bottom fade into page background */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-transparent z-0" />

      {/* ✅ Content stays centered (not full width) */}
      <div className="relative z-10 text-center px-6 sm:px-12 max-w-3xl transition-all duration-700 ease-in-out">
        <h1 className="text-5xl lg:text-6xl font-extrabold mb-6 leading-tight text-white drop-shadow-xl">
          {heading}
        </h1>
        <p className="text-lg sm:text-xl text-zinc-300 mb-8 leading-relaxed">
          {subheading}
        </p>

        <Link
          to="/clubs"
          className="bg-yellow-500 text-black font-semibold px-6 py-3 rounded-full shadow-md hover:bg-yellow-400 transition"
        >
          Join SuperFilm
        </Link>
      </div>
    </div>
  );
}





