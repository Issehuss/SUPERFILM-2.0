// src/pages/CookiesPage.jsx
import React from "react";

export default function CookiesPage() {
  return (
    <div className="min-h-screen w-full bg-black text-zinc-200 py-20 px-6 flex justify-center">
      <div className="max-w-3xl w-full bg-zinc-900/70 backdrop-blur-md rounded-2xl p-10 shadow-xl border border-zinc-700/40">
        <h1 className="text-4xl font-semibold text-superfilm-yellow mb-8">Cookies Policy</h1>

        <p className="text-lg leading-relaxed mb-6 text-zinc-300">
          SuperFilm uses cookies strictly to ensure the platform works properly. We do not
          use advertising cookies or sell any personal data. This policy explains what cookies
          we use, why we use them, and how you can control them.
        </p>

        <h2 className="text-2xl font-medium text-superfilm-yellow mt-10 mb-3">1. Essential Cookies (Required)</h2>
        <p className="text-lg leading-relaxed mb-6 text-zinc-300">
          These cookies are necessary for SuperFilm to function correctly:
        </p>
        <ul className="list-disc ml-6 mb-6 text-zinc-300 text-lg space-y-2">
          <li><strong>Authentication cookies (Supabase):</strong> Keep you signed in securely.</li>
          <li><strong>Session cookies:</strong> Maintain platform stability and connection safety.</li>
          <li><strong>Local preferences:</strong> UI settings or saved preferences (stored in LocalStorage, not sent anywhere).</li>
        </ul>
        <p className="text-lg leading-relaxed mb-6 text-zinc-300">
          These cookies are essential and do not require user consent under UK/EU law.
        </p>

        <h2 className="text-2xl font-medium text-superfilm-yellow mt-10 mb-3">2. No Advertising or Tracking Cookies</h2>
        <p className="text-lg leading-relaxed mb-6 text-zinc-300">
          SuperFilm does <strong>not</strong> use advertising cookies, third‑party marketing cookies,
          cross‑site tracking, personalised ads, or behavioural profiling.
        </p>

        <h2 className="text-2xl font-medium text-superfilm-yellow mt-10 mb-3">3. Analytics (Optional Future Feature)</h2>
        <p className="text-lg leading-relaxed mb-6 text-zinc-300">
          If we enable privacy‑friendly analytics in the future (such as Plausible or Supabase Analytics),
          we will update this policy accordingly. These tools do not use invasive tracking.
        </p>

        <h2 className="text-2xl font-medium text-superfilm-yellow mt-10 mb-3">4. How to Disable Cookies</h2>
        <p className="text-lg leading-relaxed mb-6 text-zinc-300">
          You may disable cookies through your browser settings. However, SuperFilm may not work properly
          if essential cookies are blocked, as they are required for login and secure functionality.
        </p>

        <p className="text-lg leading-relaxed mt-10 text-zinc-400 italic">
          This Cookies Policy may be updated as SuperFilm evolves.
        </p>
      </div>
    </div>
  );
}
