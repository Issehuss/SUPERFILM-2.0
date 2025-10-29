// src/components/DirectorsCutBadge.jsx
import clsx from "clsx";

/**
 * DirectorsCutBadge
 * Pure textual badge: “Director’s Cut”
 * - No icons/emojis
 * - Subtle cinematic glow
 * - Compact height to sit inline with usernames
 *
 * Props:
 *  - className?: string         Additional classes (e.g., `ml-2`)
 *  - size?: "xs" | "sm"         Visual size (default: "sm")
 *  - variant?: "gold" | "cyan" | "magenta" | "emerald"  (default: "gold")
 *  - title?: string             Tooltip text (default: "Director’s Cut")
 */
export default function DirectorsCutBadge({
  className = "ml-2",
  size = "sm",
  variant = "gold",
  title = "Director’s Cut",
}) {
  const sizeClasses =
    size === "xs"
      ? "text-[10px] px-2 py-[1px]"
      : "text-[11px] px-2 py-[2px]";

  const variantMap = {
    gold: "text-yellow-400 ring-yellow-500/35 shadow-[0_0_10px_rgba(255,215,0,0.35)]",
    cyan: "text-cyan-300 ring-cyan-500/35 shadow-[0_0_10px_rgba(0,255,255,0.30)]",
    magenta: "text-fuchsia-400 ring-fuchsia-500/35 shadow-[0_0_10px_rgba(255,0,255,0.32)]",
    emerald: "text-emerald-400 ring-emerald-500/35 shadow-[0_0_10px_rgba(0,255,150,0.32)]",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center uppercase tracking-wider font-semibold rounded-full",
        "bg-zinc-900/60 ring-1",
        sizeClasses,
        variantMap[variant] || variantMap.gold,
        className
      )}
      aria-label="Director’s Cut badge"
      title={title}
      data-testid="directors-cut-badge"
    >
      Director’s Cut
    </span>
  );
}
