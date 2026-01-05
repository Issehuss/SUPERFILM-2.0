// src/components/BetaBanner.jsx
import React from "react";

export default function BetaBanner() {
  return (
    <div className="w-full bg-yellow-400 text-black text-sm font-semibold">
      <div className="w-full px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-3 sm:gap-4">
        <span>
          This is beta testing. There may be bugs, so please send feedback via the “Send feedback” button in your account menu. App coming very soon! [mobile layout refresh applied]
        </span>
      </div>
    </div>
  );
}
