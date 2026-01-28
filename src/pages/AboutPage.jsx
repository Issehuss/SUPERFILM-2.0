// src/pages/AboutPage.jsx
import React from "react";
import { Link } from "react-router-dom";

/* -------------------------------------------------------------------------- */
/*                             About Page Component                           */
/* -------------------------------------------------------------------------- */

export default function AboutPage() {
  return (
    <div className="min-h-screen w-full bg-black text-zinc-200 py-20 px-6 flex justify-center">
      {/* Glass panel card */}
      <div className="max-w-3xl w-full bg-zinc-900/80 backdrop-blur-md rounded-3xl p-10 shadow-xl border border-zinc-700/40">
        {/* Title */}
        <h1 className="text-4xl font-semibold text-superfilm-yellow mb-8">
          About Us
        </h1>

        {/* Paragraphs */}
        <p className="text-lg leading-relaxed mb-4 text-zinc-200 drop-shadow-md">
          SuperFilm was built with the film community in mind. Each individual
          taste, experience, and idea about films in one place, for all to
          indulge in.
        </p>

        <p className="text-lg leading-relaxed mb-4 text-zinc-200 drop-shadow-md">
          This started off as a passion project and it will always be that. This
          is something we genuinely enjoy working on, and it brings us great
          pleasure thinking about the way it can be used, and what it will
          become.
        </p>

        <p className="text-lg leading-relaxed mb-4 text-zinc-200 drop-shadow-md">
          To make it clear, we champion the lone cinema experience. In fact,
          this was how SuperFilm came about. We both love
          going solo, but seeing groups of other people watch the same film and
          revel in joy about the film, from the outside, does get quite lonely.
        </p>

        <p className="text-lg leading-relaxed mb-4 text-zinc-200 drop-shadow-md">
          The difficulty of going up to someone and talking to them cannot be
          understated, but the burst of jubilation as a result of engaging in
          these talks concerning these very films also cannot be understated.
        </p>

        <p className="text-lg leading-relaxed mb-8 text-zinc-200 drop-shadow-md">
          So, SuperFilm, despite being created with many goals in mind, will
          always come back to one: prioritising human connection. Because what
          can be greater than experiencing an incredible film alone?
        </p>

        {/* Dramatic final line (no animation) */}
        <p className="text-2xl leading-relaxed mt-6 text-superfilm-yellow font-extrabold tracking-wider text-center">
          <strong>Doing it TOGETHER.</strong>
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Footer                                   */
/* -------------------------------------------------------------------------- */

export function SuperFilmFooter() {
  return (
    <footer className="w-full border-t border-zinc-800 text-xs text-zinc-500 py-4 mt-10 bg-black">
      <div className="mx-auto max-w-6xl w-full px-4 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Left side: links */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link to="/about" className="hover:text-superfilm-yellow">
            About Us
          </Link>
          <Link to="/terms" className="hover:text-superfilm-yellow">
            Terms &amp; Conditions
          </Link>
          <Link to="/help" className="hover:text-superfilm-yellow">
            Help
          </Link>
        </div>

        {/* Right side: copyright */}
        <div className="text-zinc-600">
          © {new Date().getFullYear()} SuperFilm. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
