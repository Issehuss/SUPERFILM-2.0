// src/components/BetaBanner.jsx
import React from "react";

export default function BetaBanner() {
  return (
    <div className="w-full bg-yellow-400 text-black text-sm font-semibold">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <span>
          This is beta testing. There may be bugs so please please please please send feedback via the “Send feedback” button in your account menu.Thank you very much!
        </span>
      </div>
    </div>
  );
}
