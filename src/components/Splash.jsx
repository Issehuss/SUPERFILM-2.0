// src/components/Splash.jsx
import React from "react";

export default function Splash({ message = "Loading…" }) {
  return (
    <div className="min-h-[60vh] w-full flex flex-col items-center justify-center bg-black text-white">
      {/* Logo box */}
      <div className="mb-4 flex flex-col items-center justify-center">
        {/* Real logo from /public */}
        <div className="h-16 w-16 rounded-2xl bg-zinc-900/50 border border-white/10 flex items-center justify-center shadow-lg overflow-hidden">
          <img
            src="/superfilm-logo.png"
            alt="SuperFilm"
            className="h-full w-full object-contain"
            loading="eager"
          />
        </div>
      </div>

      {/* App name */}
      <div className="text-sm font-semibold mb-1 text-white/90">SuperFilm</div>

      {/* Message from parent (e.g. “Finding your club…”) */}
      <p className="text-xs text-zinc-400">{message}</p>
    </div>
  );
}
