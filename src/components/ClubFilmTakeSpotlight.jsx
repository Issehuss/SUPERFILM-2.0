import { useEffect, useMemo, useRef, useState } from "react";
import DirectorsCutBadge from "./DirectorsCutBadge";
import usePageVisibility from "../hooks/usePageVisibility";

export default function ClubFilmTakeSpotlight({ takes = [], intervalMs = 8000 }) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);
  const isVisible = usePageVisibility();

  const safeTakes = useMemo(
    () => (Array.isArray(takes) ? takes.filter(Boolean) : []),
    [takes]
  );

  useEffect(() => {
    // reset pager when list length changes
    setIndex(0);
  }, [safeTakes.length]);

  useEffect(() => {
    clearInterval(timerRef.current);
    if (!safeTakes.length || !isVisible) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % safeTakes.length);
    }, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [safeTakes.length, intervalMs, isVisible]);

  if (!safeTakes.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-zinc-400">
        No takes yet — be the first to share your thoughts.
      </div>
    );
  }

  const cur = safeTakes[index];
  const isPremium =
    cur?.profiles?.is_premium === true ||
    String(cur?.profiles?.plan || "").toLowerCase() === "directors_cut";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-5 transition-colors">
      <div className="flex items-start gap-3">
        <img
          src={cur?.profiles?.avatar_url || "/default-avatar.svg"}
          alt={cur?.profiles?.display_name || "Member"}
          className="h-10 w-10 rounded-full object-cover"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/default-avatar.svg";
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <div className="truncate font-semibold text-white flex items-center gap-2">
              <span className="truncate">{cur?.profiles?.display_name || "Member"}</span>
              {isPremium && <DirectorsCutBadge className="ml-0" size="xs" />}
            </div>
            {typeof cur?.rating === "number" ? (
              <div className="shrink-0 rounded-full border border-yellow-500/30 px-2 py-0.5 text-xs text-yellow-400">
                ⭐ {cur.rating.toFixed(1)}/10
              </div>
            ) : null}
          </div>
          <p className="mt-2 line-clamp-5 text-zinc-200">{cur?.take || "—"}</p>
        </div>
      </div>

      {safeTakes.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {safeTakes.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-6 rounded-full transition-opacity ${
                i === index ? "bg-yellow-400 opacity-100" : "bg-white/20 opacity-50"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
