// src/components/DirectorsCutBadge.jsx
import clsx from "clsx";

export default function DirectorsCutBadge({
  className = "ml-2",
  size = "sm",
  active = true,
  title = undefined,
}) {
  const sizeClasses =
    size === "xxs"
      ? "text-[9px] px-1.5 py-[2px]"
      : size === "xs"
      ? "text-[10px] px-2 py-[3px]"
      : "text-[11px] px-2.5 py-[4px]";

  const palette = active
    ? {
        border: "border-[#f5c451]/70",
        bg: "bg-[radial-gradient(circle_at_20%_20%,rgba(245,196,81,0.22),rgba(0,0,0,0.45)),linear-gradient(135deg,#0a0a0a,#111015,#0a0a0a)]",
        text: "text-[#f7dba0]",
        shadow: "shadow-[0_10px_24px_rgba(0,0,0,0.45),0_0_0_1px_rgba(245,196,81,0.18)]",
      }
    : {
        border: "border-white/15",
        bg: "bg-black/60",
        text: "text-zinc-300",
        shadow: "shadow-[0_8px_18px_rgba(0,0,0,0.3)]",
      };

  return (
    <span
      className={clsx(
        "inline-flex items-center uppercase tracking-[0.18em] font-semibold rounded-full",
        palette.border,
        palette.bg,
        palette.text,
        palette.shadow,
        "backdrop-blur-sm",
        "transition-none",
        active ? "opacity-100" : "opacity-70",
        sizeClasses,
        className
      )}
      aria-label="DC badge"
      title={title}
      data-testid="directors-cut-badge"
    >
      DC
    </span>
  );
}
