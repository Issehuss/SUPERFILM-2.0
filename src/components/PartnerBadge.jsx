// src/components/PartnerBadge.jsx
import React from "react";

export default function PartnerBadge({ className = "" }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-400/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-100 " +
        className
      }
      title="SuperFilm staff account"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-red-300" aria-hidden />
      SuperFilm Partner
    </span>
  );
}
