export default function RatingTagChip({ tag, className = "" }) {
    if (!tag) return null;
    const title = tag.description
      ? `${tag.label}${tag.emoji ? " " + tag.emoji : ""} — ${tag.description}`
      : `${tag.label}${tag.emoji ? " " + tag.emoji : ""}`;
  
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium
                    bg-white/10 text-white border border-white/15 hover:bg-white/15 transition ${className}`}
        title={title}
        aria-label={title}
        role="img"
      >
        <span>{tag.label}</span>
        {tag.emoji ? <span aria-hidden>{tag.emoji}</span> : null}
      </span>
    );
  }
  