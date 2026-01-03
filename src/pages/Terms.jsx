// src/pages/Terms.jsx
import React from "react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-2">SuperFilm – Terms and Conditions</h1>
        <p className="text-sm text-zinc-400 mb-6">Last updated: 01/01/2026</p>

        <article className="prose prose-invert prose-sm max-w-none space-y-6">
          <Section title="Introduction & Acceptance">
            <p>
              Hello all! Welcome to SuperFilm’s user agreement (“Terms”). By accessing or using SuperFilm.UK and any other application, API, site, service, or product operated by SuprFilm Ltd (“SuperFilm”, “we”, “us”, “our”), you agree to be bound by these Terms. If you do not consent, you are not permitted to access or use the Services.
            </p>
            <p>
              No individual under 18 is permitted to use the Services. By using the Services, you represent and warrant that you are at least 18, have legal capacity, are not barred by applicable laws, have not been permanently removed or currently suspended, and you accept these Terms on behalf of any entity only if you have authority to bind that entity.
            </p>
          </Section>

          <Section title="Eligibility & Accounts">
            <p>
              You may create an account if you meet the above requirements. You are responsible for your credentials and all activity on your account. Use a strong password and notify us immediately if compromised. Do not sell, transfer, or license your account without SuperFilm’s written approval. Roles (Club President, Vice President, Member) define feature access but confer no ownership; SuperFilm may suspend or revoke roles at its discretion.
            </p>
          </Section>

          <Section title="User Generated Content">
            <p>
              You may upload, post, or share text, links, photos, videos, audio, images, or other materials (“User Content”). You warrant you have rights to it and grant SuperFilm a non-exclusive, worldwide, royalty-free licence to host, display, reproduce, and distribute it within the Services. You are solely responsible for your User Content. SuperFilm does not endorse or guarantee its accuracy and may remove content that violates these Terms or law.
            </p>
          </Section>

          <Section title="Content Standards & Prohibited Conduct">
            <ul>
              <li>Content must be respectful, lawful, relevant, and not misrepresent facts, people, or organisations.</li>
              <li>No defamatory, obscene, hateful, discriminatory, harassing, or threatening material; no violence, self-harm, illegal activity, inappropriate nudity, IP/privacy infringement, or malware.</li>
              <li>Do not access others’ accounts, bypass security, scrape/harvest data without consent, spam, impersonate, use the Services for illegal/fraudulent purposes, harm minors, or upload copyrighted material without permission.</li>
              <li>Report violations to Hussein@superfilm.info or Kacper@superfilm.info.</li>
            </ul>
          </Section>

          <Section title="Event Listings and Meet Ups">
            <p>
              Events are user-led unless SuperFilm states otherwise. Listings are not endorsements. Hosts must comply with law and venue rules, provide accurate details, manage safety, and handle attendee data lawfully. Attendees are responsible for their conduct, travel, and property. Participation is at your own risk; see the full Event terms above for responsibilities, assumptions of risk, refunds, cancellations, and incident reporting. Nothing here excludes liability where unlawful to do so.
            </p>
          </Section>

          <Section title="Verification and Safety">
            <p>
              Services are 18+. SuperFilm does not run background checks and has no duty to vet users. We may request ID/verification at any time and may restrict features until complete. You assume risks of online/offline interactions and events; follow sensible safety practices. Misrepresenting age/identity or being under 18 is a material breach.
            </p>
          </Section>

          <Section title="Intellectual Property Rights">
            <p>
              All Service content, features, and branding are owned by SuprFilm Ltd. You receive a limited, revocable, non-transferable, non-sublicensable licence for personal, non-commercial use. Do not exploit, copy, or misuse our IP. User Content ownership is unaffected (see User Generated Content). SuperFilm logos/names must not be used without permission except as explicitly allowed.
            </p>
          </Section>

          <Section title="Payments and Fees (Director’s Cut)">
            <p>
              Director’s Cut is an optional premium subscription processed via Stripe. Monthly auto-renew until cancelled. One 14-day free trial per user; charges apply after the trial unless cancelled before it ends. Cancel anytime; access continues until period end. Prices may change with notice. Payments are generally non-refundable except where required by law. Director’s Cut is ad-free.
            </p>
          </Section>

          <Section title="Advertising & Sponsorship">
            <p>
              Ads or sponsored content may appear and will be labelled. Director’s Cut members do not see third-party ads. Sponsors may receive aggregated/anonymised analytics; no personal data is shared without consent. Advertisers must comply with applicable law; SuperFilm may reject or remove ads at its discretion.
            </p>
          </Section>

          <Section title="Use Of Our Logo">
            <p>
              The SuperFilm name, logo, and design elements are the property of SuprFilm Ltd. Limited, truthful references are allowed; no alteration, resale, confusing use, or implication of endorsement without written consent. Permissions may be withdrawn at any time. Requests: Hussein@superfilm.info or Kacper@superfilm.info.
            </p>
          </Section>

          <Section title="Moderation">
            <p>
              SuperFilm may review or disclose content when reported, when unlawful/harmful conduct is suspected, or when required by law. Actions may include removal, warnings, suspension, or termination. Decisions are final; appeals are at SuperFilm’s discretion. Moderation data (reports, IDs, message content) is stored for safety/legal reasons.
            </p>
          </Section>

          <Section title="Data and Privacy">
            <p>
              SuperFilm complies with UK GDPR/Data Protection Act 2018. We collect account info, user content, limited technical data, transactional data (via Stripe), and moderation data. No under-18 data. Lawful bases include contract, legitimate interests, consent (cookies), and legal obligations. Supabase hosts data; Stripe processes payments. Aggregated, non-identifiable analytics may be shared; no personal data to sponsors/advertisers without consent. Data is retained while active and up to 90 days post-deletion unless required longer. You have rights to access, correct, delete, object, restrict, and port. Contact Hussein@superfilm.info or Kacper@superfilm.info. Cookies are used for sessions, preferences, and limited analytics.
            </p>
          </Section>

          <Section title="Third Party Links and Integrations">
            <p>
              Third-party links or integrations are used at your own risk; SuperFilm is not responsible for third-party content or services. Contracts with third parties are solely between you and them.
            </p>
          </Section>

          <Section title="Liability & Disclaimers">
            <p>
              Services are provided “as is/as available.” We exclude indirect and consequential damages to the fullest extent permitted by English law. Liability caps at the greater of amounts paid in the last 12 months or £100, where not legally excluded. Nothing limits liability for death/personal injury caused by negligence, fraud, or other non-excludable liability.
            </p>
          </Section>

          <Section title="Indemnity">
            <p>
              You agree to indemnify SuperFilm for claims arising from your use, User Content, events, breaches of these Terms, misuse of branding, or reliance on third parties. You will cooperate with our defence and not settle without consent. Obligations survive account termination.
            </p>
          </Section>

          <Section title="Governing Law & Jurisdiction">
            <p>
              These Terms are governed by the laws of England and Wales; courts of England and Wales have exclusive jurisdiction (UK consumers may also use local courts). Mandatory local rights remain unaffected. English controls.
            </p>
          </Section>

          <Section title="Changes to These Terms">
            <p>
              SuperFilm may amend these Terms; the “Last updated” date will change and material updates may include additional notice. Continued use after updates constitutes acceptance; discontinue use if you do not agree.
            </p>
          </Section>

          <Section title="Contact Information">
            <p>Email: Hussein@superfilm.info &amp; Kacper@superfilm.info</p>
            <p>SuprFilm Ltd, London, United Kingdom</p>
          </Section>
        </article>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold text-yellow-300">{title}</h2>
      <div className="text-sm leading-6 text-zinc-100">{children}</div>
    </section>
  );
}
