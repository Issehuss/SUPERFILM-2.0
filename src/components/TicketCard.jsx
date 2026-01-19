// components/TicketCard.jsx
import React from "react";
import { MapPin, CalendarClock } from "lucide-react";

/**
 * A cinema-ticket styled card.
 * - Perforated vertical separator
 * - Circular notches
 * - Faux barcode
 */
const TicketCard = ({ title, tagline, location, dateLabel }) => {
  return (
    <div className="relative rounded-2xl bg-zinc-900/80 border border-zinc-800 text-white p-4 sm:p-5 shadow-lg overflow-hidden">
      {/* Notches */}
      <span className="absolute -left-3 top-8 w-6 h-6 rounded-full bg-black border border-zinc-800" />
      <span className="absolute -left-3 bottom-8 w-6 h-6 rounded-full bg-black border border-zinc-800" />
      <span className="absolute -right-3 top-8 w-6 h-6 rounded-full bg-black border border-zinc-800" />
      <span className="absolute -right-3 bottom-8 w-6 h-6 rounded-full bg-black border border-zinc-800" />

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
        {/* Left: info */}
        <div>
          <div className="text-yellow-400 font-semibold text-sm uppercase tracking-wide mb-1">
            Screening
          </div>
          <h3 className="text-xl font-bold leading-snug">{title}</h3>
          {tagline && <p className="text-sm text-zinc-300 mt-1">{tagline}</p>}

          <div className="flex flex-col gap-2 mt-4 text-sm">
            {location && (
              <div className="flex items-center gap-2 text-red-300">
                <MapPin className="w-4 h-4" />
                <span className="text-zinc-200">{location}</span>
              </div>
            )}
            {dateLabel && (
              <div className="flex items-center gap-2 text-zinc-300">
                <CalendarClock className="w-4 h-4" />
                <span>{dateLabel}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: perforation + barcode */}
        <div className="relative flex flex-col items-center md:items-end">
          {/* Perforation */}
          <div
            className="absolute -left-4 top-0 bottom-0 w-4 hidden md:block"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, transparent 0 6px, rgba(255,255,255,0.12) 6px 7px)",
            }}
          />
          {/* Barcode */}
          <div className="mt-1 md:mt-0 bg-white p-2 rounded-md">
            <svg width="94" height="40" viewBox="0 0 94 40">
              <rect width="94" height="40" fill="#fff" />
              {/* simple bars */}
              {[2,6,8,12,15,18,22,25,28,31,34,38,41,44,47,50,53,56,60,63,66,70,73,76,80,83,86,89].map((x,i)=>(
                <rect key={i} x={x} y="4" width={(i%3===0)?3:2} height="32" fill="#000" />
              ))}
            </svg>
          </div>
          <div className="text-[10px] text-zinc-400 mt-1 tracking-widest">
            ADMIT•ONE
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketCard;
