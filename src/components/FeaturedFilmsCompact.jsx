// src/components/FeaturedFilmsCompact.jsx
import { Sparkles, Plus } from "lucide-react";
import { Link } from "react-router-dom";

export default function FeaturedFilmsCompact({
  posters = [],            // array of poster URLs you already store
  metaMap = {},            // posterUrl -> { id, title }
  canEdit = false,
  onEdit,                  // open your “feature film” picker (optional)
}) {
  const hasAny = Array.isArray(posters) && posters.length > 0;

  return (
    <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-yellow-400">Featured Films</h3>
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
          >
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      {hasAny ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
          {posters.map((url, i) => {
            const meta = metaMap?.[url] || {};
            const href = meta?.id ? `/movies/${meta.id}` : "#";
            return (
              <Link
                key={`${url}-${i}`}
                to={href}
                onClick={(e) => { if (!meta?.id) e.preventDefault(); }}
                className="shrink-0 w-[150px] md:w-[160px] rounded-xl overflow-hidden ring-1 ring-white/10 hover:ring-yellow-400/60 transition group"
                title={meta?.title || "Featured film"}
              >
                <img
                  src={url}
                  alt={meta?.title || "Featured film"}
                  className="block w-full h-auto group-hover:scale-[1.02] transition"
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div className="px-2 py-1 text-[11px] text-zinc-300 bg-black/40">
                  {meta?.title || "Featured"}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState canEdit={canEdit} onEdit={onEdit} />
      )}
    </div>
  );
}

function EmptyState({ canEdit, onEdit }) {
  return (
    <div className="h-full min-h-[140px] flex flex-col items-center justify-center text-center border border-dashed border-white/10 rounded-xl">
      <Sparkles className="mb-2 opacity-70" />
      <p className="text-sm text-zinc-300 max-w-[22ch]">
        Show your club’s **signature taste** — pick a few films that represent you.
      </p>
      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="mt-2 text-xs px-3 py-1.5 rounded bg-yellow-500 text-black font-semibold hover:bg-yellow-400"
        >
          Feature films
        </button>
      )}
    </div>
  );
}
