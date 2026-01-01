// src/pages/CommunityGuidelines.jsx
import React from "react";

export default function CommunityGuidelines() {
  return (
    <div className="min-h-screen w-full bg-black text-zinc-200 py-20 px-6 flex justify-center">
      <div className="max-w-3xl w-full bg-zinc-900/70 backdrop-blur-md rounded-2xl p-10 shadow-xl border border-zinc-700/40">
        <h1 className="text-4xl font-semibold text-superfilm-yellow mb-8">Community Guidelines</h1>

        <p className="text-lg leading-relaxed mb-6 text-zinc-300">
          SuperFilm exists to be a warm, respectful home for film lovers, clubs, and creators.
          These guidelines ensure our community stays welcoming, safe, and human.
        </p>

        {/* 1. Respect Others */}
        <h2 className="text-2xl font-medium text-superfilm-yellow mt-10 mb-3">1. Be Respectful of Other Film Lovers</h2>
        <p className="text-lg leading-relaxed mb-6 text-zinc-300">
          Film taste is personal. Debate films, not people. Share opinions, not attacks.
          Insults, harassment, hate speech, slurs, or personal digs are not allowed.
        </p>

        {/* 2. No Discrimination */}
        <h2 className="text-2xl font-medium text-superfilm-yellow mt-10 mb-3">2. No Discrimination or Harmful Behaviour</h2>
        <p className="text-lg leading-relaxed mb-6 text-zinc-300">
          SuperFilm is for everyone. No racism, sexism, homophobia, transphobia, ableism,
          or any form of demeaning or harmful behaviour.
        </p>

        {/* 3. Clubs */}
        <h2 className="text-2xl font-medium text-superfilm-yellow mt-10 mb-3">3. Keep Clubs Safe & Welcoming</h2>
        <p className="text-lg leading-relaxed mb-6 text-zinc-300">
          Clubs are at the heart of SuperFilm. Respect club rules, be friendly to new members,
          and help maintain a positive environment. Club leaders may set additional rules.
        </p>

        {/* 4. Spoilers */}
        <h2 className="text-2xl font-medium text-superfilm-yellow mt-10 mb-3">4. Use Spoiler Warnings</h2>
        <p className="text-lg leading-relaxed mb-6 text-zinc-300">
          If your post contains major plot points, twists, or endings, please include a clear
          "SPOILER WARNING" at the top.
        </p>

        {/* 5. Legal Sharing */}
        <h2 className="text-2xl font-medium text-superfilm-yellow mt-10 mb-3">5. Share Legally & Responsibly</h2>
        <p className="text-lg leading-relaxed mb-6 text-zinc-300">
          Share film stills, posters, text reviews, and event images responsibly. Do not upload
          pirated content, full movie scenes, or copyrighted material you do not have the rights to.
          NSFW or explicit adult content is not allowed.
        </p>

        {/* 8. Privacy */}
        <h2 className="text-2xl font-medium text-superfilm-yellow mt-10 mb-3">6. Protect Your Privacy & Others'</h2>
        <p className="text-lg leading-relaxed mb-6 text-zinc-300">
          Do not post private information about yourself or others. Do not share screenshots of private
          club chats. Impersonation or misleading accounts are not permitted.
        </p>

        {/* 9. Reporting */}
        <h2 className="text-2xl font-medium text-superfilm-yellow mt-10 mb-3">7. Report Issues — Don’t Escalate</h2>
        <p className="text-lg leading-relaxed mb-6 text-zinc-300">
          If someone violates these guidelines, please report them rather than retaliate. Our
          moderation team will review the situation.
        </p>

        {/* 10. Core Mission */}
        <h2 className="text-2xl font-medium text-superfilm-yellow mt-10 mb-3">8. Remember Why We’re Here</h2>
        <p className="text-lg leading-relaxed mb-6 text-zinc-300">
          SuperFilm was created to help people connect through cinema. If a behaviour harms that mission,
          it does not belong here.
        </p>

        <p className="text-lg leading-relaxed mt-10 text-zinc-400 italic">
          These guidelines may be updated as SuperFilm grows.
        </p>
      </div>
    </div>
  );
}
