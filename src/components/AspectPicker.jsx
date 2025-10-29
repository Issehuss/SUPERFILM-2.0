import React from "react";
import { ASPECTS } from "../constants/aspects";

export default function AspectPicker({ value, onChange, className = "" }) {
  return (
    <div className={["flex flex-wrap gap-2", className].join(" ")}>
      {ASPECTS.map((a) => {
        const active = value === a.key;
        return (
          <button
            key={a.key}
            type="button"
            onClick={() => onChange(active ? null : a.key)}
            className={[
              "px-2 py-1 text-xs rounded-full border transition",
              active
                ? "bg-yellow-500 text-black border-yellow-500"
                : "bg-white/5 text-zinc-200 border-white/10 hover:border-yellow-500/60"
            ].join(" ")}
            aria-pressed={active ? "true" : "false"}
          >
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
