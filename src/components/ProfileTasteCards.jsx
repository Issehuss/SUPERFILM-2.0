// src/components/ProfileTasteCards.jsx
import React, { useMemo } from "react";
import TasteCard from "./TasteCard";

const DEFAULT_COLOR = "#facc15"; // warm amber

function pickCardColor(card, globalFallback) {
  const mode = (card?.style?.mode || "glow").toLowerCase();
  const color =
    (mode === "outline" ? card?.style?.outline : card?.style?.glow) ||
    globalFallback ||
    DEFAULT_COLOR;
  return color;
}

function deriveGlobalGlow(cards, explicit) {
  if (explicit) return explicit;

  // First valid color
  for (const c of cards) {
    const m = (c?.style?.mode || "glow").toLowerCase();
    const col = m === "outline" ? c?.style?.outline : c?.style?.glow;
    if (typeof col === "string" && col.trim()) return col;
  }

  // Most common color across cards
  const counts = new Map();
  for (const c of cards) {
    const m = (c?.style?.mode || "glow").toLowerCase();
    const col = m === "outline" ? c?.style?.outline : c?.style?.glow;
    if (typeof col === "string" && col.trim()) {
      counts.set(col, (counts.get(col) || 0) + 1);
    }
  }
  if (counts.size) {
    let best = DEFAULT_COLOR;
    let max = 0;
    for (const [col, n] of counts) {
      if (n > max) { max = n; best = col; }
    }
    return best;
  }

  return DEFAULT_COLOR;
}

export default function ProfileTasteCards({ cards = [], globalGlow }) {
  // Always run hooks before any conditional return
  const clean = useMemo(() => {
    if (!Array.isArray(cards)) return [];
    return cards.filter(
      (c) =>
        c &&
        typeof c.question === "string" &&
        c.question.trim().length > 0 &&
        typeof c.answer === "string" &&
        c.answer.trim().length > 0
    );
  }, [cards]);

  const resolvedGlobal = useMemo(
    () => deriveGlobalGlow(clean, globalGlow),
    [clean, globalGlow]
  );

  if (clean.length === 0) return null;

  return (
    <div className="w-full px-3 sm:px-6 py-4 sm:py-6">
      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4 md:gap-5">
        {clean.map((card, idx) => {
          const color = pickCardColor(card, resolvedGlobal);
          return (
            <TasteCard
              key={card.id || `${card.presetId || "card"}-${idx}`}
              question={card.question}
              answer={card.answer}
              glowColor={color}
              className="min-w-0"
            />
          );
        })}
      </div>
    </div>
  );
}
