// src/components/FilmAverageCell.jsx
import { useMemo } from "react";
import { Star } from "lucide-react";

/**
 * FilmAverageCell
 * Displays a read-only average rating graphic.
 *
 * Props:
 * - average: number | null
 * - counts: number[] (length 5, index 0 = 1★)
 * - total: number
 */
export default function FilmAverageCell({
  average,
  counts = [0, 0, 0, 0, 0],
  total = 0,
}) {
  const avgText = useMemo(() => {
    if (average == null) return "—";
    const n = Number(average);
    return Number.isFinite(n) ? n.toFixed(1) : "—";
  }, [average]);

  const avgValue = useMemo(() => {
    const n = Number(average);
    return Number.isFinite(n) ? Math.max(0, Math.min(5, n)) : 0;
  }, [average]);

  const fillPct = useMemo(() => (avgValue / 5) * 100, [avgValue]);

  const safeCounts = useMemo(() => {
    const base = Array.isArray(counts) && counts.length === 5 ? counts : [0, 0, 0, 0, 0];
    return base.map((v) => Math.max(0, Number(v) || 0));
  }, [counts]);

  const maxCount = useMemo(
    () => Math.max(1, ...safeCounts),
    [safeCounts]
  );

  const stars = useMemo(
    () =>
      Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={16} className="shrink-0" />
      )),
    []
  );

  return (
    <div className="h-full rounded-2xl border border-white/10 bg-gradient-to-br from-black/70 via-zinc-900/70 to-black/80 p-4 sm:p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.22em] text-zinc-400">
        <span>Average rating</span>
        <span>{total ? `${total} ratings` : "No ratings yet"}</span>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-3xl sm:text-4xl font-semibold text-white">
            {avgText}
            {total ? (
              <span className="ml-1 text-sm text-zinc-400">/5</span>
            ) : null}
          </div>
          <div className="mt-2 flex items-center gap-2 text-zinc-500">
            <div className="relative inline-flex">
              <div className="flex text-zinc-700">{stars}</div>
              <div
                className="absolute left-0 top-0 overflow-hidden text-yellow-400"
                style={{ width: `${fillPct}%` }}
              >
                <div className="flex">{stars}</div>
              </div>
            </div>
            <span className="text-xs text-zinc-500">Average</span>
          </div>
        </div>

        <div className="flex items-end gap-2">
          {[5, 4, 3, 2, 1].map((star, idx) => {
            const count = safeCounts[star - 1];
            const height = Math.round((count / maxCount) * 100);
            return (
              <div key={star} className="flex flex-col items-center gap-1">
                <div className="h-12 w-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="w-full rounded-full bg-yellow-400/80"
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="text-[10px] text-zinc-500">{star}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
