// src/pages/Terms.jsx
import React from "react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-2">SuperFilm — Terms and Conditions</h1>
        <p className="text-sm text-zinc-400 mb-6">Last updated: 2025-01-01</p>

        <article className="prose prose-invert prose-sm max-w-none space-y-6">
          <Section title="Introduction & Acceptance">
            <p>
              Hello all! Welcome to SuperFilm’s user agreement (“Terms”). By accessing or using SuperFilm.UK and any other application, API, site, service, or product operated by SuprFilm Ltd (“SuperFilm”, “we”, “us”, “our”), you agree to be bound by these Terms. If you do not wish to consent, you are not permitted to access or use the Services.
            </p>
            <p>
              No individual under the age of 18 is permitted to use the Services. By using the Services, you represent and warrant that you are at least 18, have the legal capacity to form a contract, are not barred by applicable laws, have not been permanently suspended or currently suspended, and if you accept on behalf of an entity you have full authority to bind that entity.
            </p>
          </Section>

          <Section title="Eligibility & Accounts">
            <p>
              You are eligible to create an account if you meet Section 1.2. To create an account, you will share a username and password (stored securely per Section 12). You are responsible for your account information and all activity under it. If compromised, notify SuperFilm immediately. Use a strong password and never sell, transfer, or license your account without written approval.
            </p>
          </Section>

          <Section title="Roles">
            <p>Users may hold roles (Club President, Vice President, Member) that define features and responsibilities but confer no ownership. SuperFilm may suspend accounts, revoke roles, or restrict access at its discretion.</p>
            <ul>
              <li><strong>Club President:</strong> Enhanced cosmetic controls and event hosting; responsible for representing members; cannot remove members (removal reserved to SuperFilm).</li>
              <li><strong>Club Vice President:</strong> Same authority expectations as Club President; must align with the club.</li>
              <li><strong>Member:</strong> Access to Services, clubs, events, and interactions; must follow respectful behaviour (see Section 4 and 11).</li>
            </ul>
          </Section>

          <Section title="User Generated Content">
            <p>
              You may upload or share text, links, photos, videos, audio, images, or other materials (“User Content”). You warrant you own or have rights to it and grant SuperFilm a non-exclusive, worldwide, royalty-free licence to host, display, reproduce, and distribute it within the Services. You are solely responsible for your User Content. SuperFilm does not endorse or guarantee its accuracy and may review/remove content that violates these Terms or law.
            </p>
          </Section>

          <Section title="Content Standards and Prohibited Conduct">
            <p>Content must be respectful, lawful, relevant, and must not misrepresent facts, people, or organisations. Do not post defamatory, obscene, hateful, discriminatory, harassing, or threatening material; promote violence, self-harm, illegal activity, or inappropriate nudity; infringe IP/privacy rights; or include malware.</p>
            <p>Prohibited conduct includes: accessing others’ accounts; bypassing security; scraping/harvesting data without consent; spam/scams/unsolicited ads; impersonation; illegal/fraudulent use; organising illegal events; uploading copyrighted material without permission; harming minors. Report issues to Kacper@superfilm.info.</p>
          </Section>

          <Section title="Event Listings and Meet Ups">
            <ul className="list-disc pl-4 space-y-1">
              <li>Events are user-led unless SuperFilm states otherwise; listings are not endorsements.</li>
              <li>Hosts must comply with law/venue rules, provide clear details, manage safety/capacity, handle attendee data lawfully, and present refund/cancellation policies.</li>
              <li>Attendees are responsible for conduct, travel, and property; participation is at your own risk.</li>
              <li>SuperFilm may restrict/remove risky listings; age/verification may apply (18+).</li>
              <li>Assumption of risk: you accept risks of events/meetups. Release/indemnity applies to event conduct to the fullest extent permitted by English law.</li>
            </ul>
          </Section>

          <Section title="Verification and Safety">
            <p>
              Services are 18+. SuperFilm does not conduct background checks and has no duty to vet users. We may request verification (e.g., ID or selfie) and may restrict features until complete. Online/offline interactions carry risk; follow safety practices and contact emergency services if needed. Misrepresenting age/identity or being under 18 is a material breach.
            </p>
          </Section>

          <Section title="Intellectual Property Rights">
            <p>
              All content, features, and functionality of the Services are owned by SuprFilm Ltd and licensors. You receive a limited, non-exclusive, revocable, non-transferable, non-sublicensable licence for personal, non-commercial use. Do not copy, exploit, or misuse our IP. User Content ownership remains yours, subject to the licence in Section 3. Branding use is restricted (see Section 10).
            </p>
          </Section>

          <Section title="Payments And Fees">
            <p>
              Director’s Cut is optional premium membership. Payments are processed by Stripe; Stripe terms apply. Subscriptions auto-renew monthly until cancelled; one 14-day free trial per user. Cancel anytime; no refunds for partial periods unless required by law. Prices may change with notice. Premium users do not see third-party ads.
            </p>
          </Section>

          <Section title="Advertising & Sponsorship">
            <p>
              Ads/sponsored content may appear and will be labelled. Director’s Cut users do not see third-party ads. Sponsors may receive aggregated/anonymised analytics; no personal data shared without consent. SuperFilm may reject or remove ads at its discretion.
            </p>
          </Section>

          <Section title="Use Of Our Logo">
            <p>
              The SuperFilm name, logo, and design elements are property of SuprFilm Ltd. Limited truthful references are allowed; no alteration, resale, confusing use, or implication of endorsement without written consent. Permissions can be withdrawn. Requests: Kacper@superfilm.info.
            </p>
          </Section>

          <Section title="Moderation">
            <p>
              SuperFilm may review/disclose content when reported, when unlawful/harmful conduct is suspected, or when required by law. Actions may include removal, warnings, suspension, or termination. Decisions are final; appeals are at our discretion. Moderation data (reports, IDs, message content) is stored for safety/legal purposes.
            </p>
          </Section>

          <Section title="Data and Privacy">
            <p>
              SuperFilm complies with UK GDPR/Data Protection Act 2018. We collect account info, User Content, limited technical data, transactional data (via Stripe), and moderation data. No under-18 data. Lawful bases: contract, legitimate interests, consent (cookies), legal obligation. Supabase hosts data; Stripe processes payments. Aggregated, non-identifiable analytics may be shared; no personal data to sponsors/advertisers without consent.
            </p>
            <p>
              Data retained while active and up to 90 days post-deletion unless required longer. Rights: access, correction, deletion, objection/restriction, portability. Contact Kacper@superfilm.info. Cookies are used for sessions, preferences, limited analytics; manage via browser settings.
            </p>
          </Section>

          <Section title="Third Party Links and Integrations">
            <p>
              Third-party links/integrations are at your own risk; SuperFilm is not responsible for third-party content or services. Contracts with third parties are solely between you and them.
            </p>
          </Section>

          <Section title="Liability & Disclaimers">
            <p>
              Services are provided “as is/as available.” To the fullest extent permitted by English law, we exclude indirect, consequential, and certain damages. Aggregate liability (where not excluded) is capped at the greater of amounts paid in the last 12 months or £100. Nothing limits liability for death/personal injury caused by negligence, fraud, or other non-excludable liability.
            </p>
          </Section>

          <Section title="Indemnity">
            <p>
              You agree to indemnify SuperFilm for claims arising from your use, User Content, events, breaches of these Terms, misuse of branding, or reliance on third parties. Cooperate with our defence; do not settle without consent. Obligations survive account termination.
            </p>
          </Section>

          <Section title="Governing Law & Jurisdiction">
            <p>
              These Terms are governed by the laws of England and Wales; courts of England and Wales have exclusive jurisdiction (UK consumers may also use local courts). Mandatory local rights remain unaffected. English prevails.
            </p>
          </Section>

          <Section title="Changes to These Terms">
            <p>
              SuperFilm may amend these Terms; the “Last updated” date will change and material updates may include additional notice. Continued use after updates constitutes acceptance; discontinue use if you do not agree.
            </p>
          </Section>

          <Section title="Contact Information">
            <p>Email: Kacper@superfilm.info</p>
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
