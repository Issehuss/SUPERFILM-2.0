import React from "react";
import RatingTagChip from "./RatingTagChip";

// You can replace this with your existing Star component/picker if you want half-stars etc.
function StarPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)} className="p-0.5" title={`${n}/5`}>
          <span className={`text-lg ${value >= n ? "text-yellow-400" : "text-zinc-500"}`}>★</span>
        </button>
      ))}
      <div className="ml-2 text-sm text-zinc-400">{value || "—"}/5</div>
    </div>
  );
}

export default function RatingInput({
  isPremium,
  scheme,                  // { tags: [...] } or null
  defaultMode = "stars",   // 'tags' | 'stars'
  value,                   // object { rating_5?, tag_id?, ... } or number for compatibility
  onChange,
}) {
  const canUseTags = isPremium && scheme?.tags?.length > 0;
  const [mode, setMode] = React.useState(canUseTags ? defaultMode : "stars");

  React.useEffect(() => {
    if (!canUseTags && mode !== "stars") setMode("stars");
  }, [canUseTags, mode]);

  const currentStars = typeof value === "number" ? value : (value?.rating_5 ?? 0);

  return (
    <div className="space-y-2">
      {canUseTags && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">Rate with:</span>
          <button
            type="button"
            onClick={() => setMode("tags")}
            className={`rounded-full px-2 py-1 ${mode==="tags" ? "bg-yellow-500 text-black" : "bg-zinc-800 text-white"}`}
          >
            Tags
          </button>
          <button
            type="button"
            onClick={() => setMode("stars")}
            className={`rounded-full px-2 py-1 ${mode==="stars" ? "bg-yellow-500 text-black" : "bg-zinc-800 text-white"}`}
          >
            Stars
          </button>
        </div>
      )}

      {mode === "tags" && canUseTags ? (
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {scheme.tags.sort((a,b)=>a.order-b.order).map((tag) => {
            const selected = value?.tag_id === tag.id;
            return (
              <button
                key={tag.id}
                type="button"
                role="radio"
                aria-checked={selected ? "true" : "false"}
                onClick={() => onChange({
                  tag_id: tag.id,
                  tag_label: tag.label,
                  tag_desc: tag.description ?? null,
                  tag_emoji: tag.emoji ?? null,
                  custom_weight: tag.weight,
                  rating_5: tag.weight,   // keep numeric snapshot
                })}
                className={`rounded-full ring-1 px-0.5 py-0.5 ${selected ? "ring-yellow-400" : "ring-transparent"}`}
                title={tag.description || tag.label}
              >
                <RatingTagChip tag={tag} className={selected ? "bg-yellow-500/20 border-yellow-500/40" : ""} />
              </button>
            );
          })}
        </div>
      ) : (
        <StarPicker
          value={currentStars}
          onChange={(stars) => onChange({
            rating_5: stars,
            custom_weight: null,
            tag_id: null,
            tag_label: null,
            tag_desc: null,
            tag_emoji: null,
          })}
        />
      )}
    </div>
  );
}
