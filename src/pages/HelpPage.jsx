// src/pages/HelpPage.jsx
import React from "react";

const contacts = [
  { email: "hussein@superfilm.info", description: "General enquiries, membership, and screening support" },
  { email: "kacper@superfilm.info", description: "Technical, safety, or policy questions" },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-zinc-400">Need guidance?</p>
          <h1 className="text-3xl font-semibold text-white">
            Help &amp; contact
          </h1>
        </div>

        <p className="text-base text-zinc-200 leading-relaxed">
          These email addresses are the official help points for any enquiries about SuperFilm. If you  have questions about your account, want to report an issue, or just need a friendly pointer then just  pick the contact that matches your concern and we will get back to you as soon as we can.
        </p>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-6 shadow-sm">
          {contacts.map((contact) => (
            <div key={contact.email} className="space-y-1">
              <a
                className="text-lg font-semibold text-superfilm-yellow hover:text-yellow-300"
                href={`mailto:${contact.email}`}
              >
                {contact.email}
              </a>
              <p className="text-sm text-zinc-400">{contact.description}</p>
            </div>
          ))}
        </div>

        <p className="text-sm text-zinc-500">
          For urgent issues, please include as much detail as you can so we can reply faster. We aim to respond within 24 hours during business days.
        </p>
      </div>
    </div>
  );
}
