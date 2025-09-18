// src/pages/LandingPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const carouselSlides = [
  { heading: "Your film community lives here.", subheading: "Find your taste. Build your club. Share the experience.", image: "/decision_to_leave.jpg" },
  { heading: "Join local and online film circles.", subheading: "Meet others who share your cinematic tastes.", image: "/taste_cherry.jpg" },
  { heading: "Curate and host film screenings.", subheading: "Turn any night into a cinematic event.", image: "/rye_lane.jpg" },
  { heading: "Craft your profile through films.", subheading: "Taste Cards and Favorites speak louder than words.", image: "/worst_person.jpg" },
];

export default function LandingPage() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % carouselSlides.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const { heading, subheading, image } = carouselSlides[index];

  return (
    <div className="relative w-full h-[calc(100vh-120px)] overflow-hidden flex items-center justify-center bg-black text-white">
      {/* Centered cinematic card — rounded, no side fades */}
      <section className="relative w-full">
        <div
          className="
            relative mx-auto overflow-hidden rounded-[28px] shadow-2xl ring-1 ring-white/10
            max-w-[100vw] sm:max-w-[99vw] md:max-w-[98vw] lg:max-w-[96vw] xl:max-w-[92vw]
          "
          style={{
            // ⬅️ Fix: give the card its own height so it doesn't collapse
            height: 'clamp(600px, 95vh, 960px)',
          }}
        >
          {/* Film still */}
          <img
            src={image}
            alt="Background Still"
            className="absolute inset-0 h-full w-full object-cover object-center z-0"
            loading="eager"
            decoding="async"
          />

          {/* Legibility overlay + soft vignette (no vertical bands) */}
          <div className="absolute inset-0 bg-black/35 z-0" />
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

          {/* Content */}
          <div className="relative z-10 flex h-full items-center justify-center">
            <div className="mx-auto max-w-3xl text-center px-6 transition-all duration-700 ease-in-out">
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
        </div>
      </section>
    </div>
  );
}



