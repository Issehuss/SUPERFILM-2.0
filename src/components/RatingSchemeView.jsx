// src/components/RatingSchemeView.jsx
import React, { useMemo } from "react";

/**
 * Expected `scheme` shape:
 * {
 *   id: string,
 *   name: string,
 *   is_active: boolean,
 *   tags: Array<{
 *     id: string,
 *     label: string,
 *     emoji?: string,
 *     weight?: number,           // 0.5–5.0
 *     description?: string,      // tooltip text
 *     category?: string,         // 'emotion' | 'tone' | 'experience' | 'critique' | 'rewatch' | 'visuals' | 'genre' | ...
 *     order?: number
 *   }>
 * }
 */

const CATEGORY_LABELS = {
  emotion: "Emotion",
  tone: "Tone / Style",
  experience: "Experience",
  critique: "Critique",
  rewatch: "Rewatchability",
  visuals: "Visuals",
  genre: "Genre Vibes",
  // fallback label for any custom category IDs
  other: "Other",
};

function groupTags(tags = []) {
  const groups = {};
  for (const t of tags) {
    const cat = (t.category || "other").toLowerCase();
    (groups[cat] ||= []).push(t);
  }
  // sort inside each group by .order then label
  for (const cat of Object.keys(groups)) {
    groups[cat].sort((a, b) => {
      const ao = Number.isFinite(a.order) ? a.order : 9999;
      const bo = Number.isFinite(b.order) ? b.order : 9999;
      if (ao !== bo) return ao - bo;
      return String(a.label || "").localeCompare(String(b.label || ""));
    });
  }
  return groups;
}

export default function RatingSchemeView({ scheme }) {
  const hasTags = Array.isArray(scheme?.tags) && scheme.tags.length > 0;

  const groups = useMemo(() => (hasTags ? groupTags(scheme.tags) : {}), [hasTags, scheme?.tags]);

  if (!hasTags) return null;

  const title = scheme?.name || "My Rating Language";
  const total = scheme.tags.length;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="text-xs text-zinc-400">
          {total} {total === 1 ? "tag" : "tags"}
          {scheme?.is_active === false ? " • inactive" : ""}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {Object.entries(groups).map(([cat, tags]) => {
          const label = CATEGORY_LABELS[cat] || CATEGORY_LABELS.other;
          return (
            <div key={cat} className="space-y-2">
              <h4 className="text-xs font-semibold text-zinc-400 tracking-wide">{label}</h4>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => {
                  const tooltip =
                    t.description
                      ? `${t.label}${t.emoji ? " " + t.emoji : ""} — ${t.description}`
                      : t.label;

                  const aria = t.description || t.label;

                  return (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs
                                 bg-white/10 text-white border border-white/15"
                      title={tooltip}
                      aria-label={aria}
                    >
                      <span className="truncate max-w-[12rem]">{t.label}</span>
                      {t.emoji ? <span aria-hidden="true">{t.emoji}</span> : null}
                      {typeof t.weight === "number" ? (
                        <span className="ml-1 text-[10px] text-zinc-400">({t.weight})</span>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
