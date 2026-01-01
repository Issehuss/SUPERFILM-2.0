// src/pages/Terms.jsx
import React from "react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-2">SuperFilm – Terms and Conditions</h1>
        <p className="text-sm text-zinc-400 mb-6">Last updated: 31/12/2025</p>

        <article className="prose prose-invert prose-sm max-w-none space-y-6">
          <Section title="1. Introduction & Acceptance">
            <p>
              These Terms govern your access to and use of SuperFilm.UK and any application, API, site, service, or
              product operated by SuprFilm Ltd (“SuperFilm”, “we”, “us”, “our”). By using the Services you agree to these
              Terms. If you do not agree, do not use the Services.
            </p>
            <p>
              You must be 18+ and legally able to form a contract. You confirm you are not suspended, barred by law, or
              permanently removed from the Services. If you accept on behalf of a legal entity, you have authority to bind
              that entity.
            </p>
          </Section>

          <Section title="2. Eligibility & Accounts">
            <p>
              You may create an account if you meet the above eligibility. You are responsible for your credentials and
              all activity on your account. Use a strong password; notify us if compromised. You may not sell, transfer,
              or license your account without written approval.
            </p>
          </Section>

          <Section title="3. Roles">
            <p>Roles (Club President, Vice President, Member) define feature access but confer no ownership.</p>
            <p>
              Presidents: can customise club profile, banner, layout, and host events; cannot remove members (SuperFilm
              reserves that right under Moderation). Vice Presidents: similar authority aligned with the president/club.
              Members: all users are members and must follow these Terms.
            </p>
            <p>SuperFilm may suspend/terminate accounts or roles at its discretion.</p>
          </Section>

          <Section title="4. User Content">
            <p>
              You may post text, links, photos, videos, audio, images, or other materials (“User Content”). You warrant
              you have rights to it and grant SuperFilm a non-exclusive, worldwide, royalty-free licence to host, display,
              reproduce, and distribute it within the Services. You are solely responsible for your content. SuperFilm
              does not endorse or guarantee its accuracy and may remove content that violates these Terms or law.
            </p>
          </Section>

          <Section title="5. Content Standards & Prohibited Conduct">
            <p>Content must be respectful, lawful, and relevant. It must not misrepresent, defame, harass, threaten, be hateful or obscene, promote violence/illegal activity/self-harm, include inappropriate nudity, infringe IP/privacy, or contain malware.</p>
            <p>You must not access others’ accounts, bypass security, scrape/harvest data without consent, spam, impersonate, use the Services for illegal/fraudulent purposes, or harm minors. Report violations to Hussein@superfilm.info.</p>
          </Section>

          <Section title="6. Event Listings & Meet Ups">
            <p>
              Events are user-led unless SuperFilm states otherwise. Listings are not endorsements. Hosts must comply with
              law/venue rules, provide accurate details, manage safety, and handle attendee data lawfully. Attendees are
              responsible for their conduct, travel, and property. Participation is at your own risk. Liability is limited
              as described; nothing excludes liability where unlawful to do so.
            </p>
          </Section>

          <Section title="7. Verification & Safety">
            <p>
              Services are 18+. SuperFilm does not run background checks and has no duty to vet users. We may request ID or
              verification at any time and may restrict features until complete. You assume risks of online/offline
              interactions and events.
            </p>
          </Section>

          <Section title="8. Intellectual Property">
            <p>
              All Service content/branding is owned by SuprFilm Ltd. You receive a limited, revocable, non-transferable
              licence for personal, non-commercial use. Do not exploit, copy, or misuse our IP. User Content ownership is
              unaffected (see Section 4).
            </p>
          </Section>

          <Section title="9. Payments & Fees (Director’s Cut)">
            <p>
              Director’s Cut is an optional premium subscription. Payments are via Stripe; monthly auto-renew until
              cancelled. One 14-day free trial per user; charges apply after the trial unless cancelled before it ends.
              Cancel anytime; access continues until period end. Prices may change with notice. Payments are generally
              non-refundable except where required by law. Director’s Cut is ad-free.
            </p>
          </Section>

          <Section title="10. Advertising & Sponsorship">
            <p>
              Ads/sponsored content may appear and will be labelled. Director’s Cut members do not see third-party ads.
              Sponsors may receive aggregated/anonymised analytics; no personal data shared without consent.
            </p>
          </Section>

          <Section title="11. Use of Our Logo">
            <p>
              The SuperFilm name/logo belong to SuprFilm Ltd. Limited non-commercial references are allowed; no alteration,
              resale, confusing use, or implication of endorsement without written consent. Permissions may be withdrawn
              at any time.
            </p>
          </Section>

          <Section title="12. Moderation">
            <p>
              We do not actively monitor all content but may review/disclose when reported, suspected unlawful/harmful
              conduct, or legally required. Actions may include removal, warnings, suspension, or termination. Decisions
              are final; no obligation to appeal. Moderation data is stored for safety/legal reasons.
            </p>
          </Section>

          <Section title="13. Data & Privacy">
            <p>
              We comply with UK GDPR/Data Protection Act 2018. We collect account info, user content, limited technical
              data, transactional data (via Stripe), and moderation data. No under-18 data. Lawful bases include contract,
              legitimate interests, consent (cookies), and legal obligations. We use Supabase (hosting) and Stripe
              (payments). Aggregated, non-identifiable analytics may be shared; no PII to sponsors/advertisers without
              consent. Access is restricted; data retained while active and up to 90 days post-deletion unless required
              longer. You have rights to access, correct, delete, object, restrict, port. Contact Hussein@superfilm.info.
              Children under 18 are not allowed. Cookies are used for sessions/preferences/limited analytics.
            </p>
          </Section>

          <Section title="14. Third-Party Links & Integrations">
            <p>
              Third-party links/integrations are used at your own risk; SuperFilm is not responsible for third-party
              content or services.
            </p>
          </Section>

          <Section title="15. Liability & Disclaimers">
            <p>
              Services are provided “as is/as available.” We exclude indirect/consequential damages to the fullest extent
              permitted by English law. Liability caps at the greater of amounts paid in last 12 months or £100, where not
              legally excluded. Nothing limits liability for death/personal injury caused by negligence, fraud, or other
              non-excludable liability.
            </p>
          </Section>

          <Section title="16. Indemnity">
            <p>
              You agree to indemnify SuperFilm for claims arising from your use, content, events, breach of Terms, misuse
              of branding, or reliance on third parties. You will cooperate with our defence; do not settle without our
              consent. Obligations survive account termination.
            </p>
          </Section>

          <Section title="17. Governing Law & Jurisdiction">
            <p>
              These Terms are governed by English law. Courts of England and Wales have exclusive jurisdiction (UK
              consumers may also use local courts). Mandatory local rights remain unaffected. English version controls.
            </p>
          </Section>

          <Section title="18. Changes to These Terms">
            <p>
              We may amend these Terms and will update the “Last updated” date. Material changes may include additional
              notice. Continued use constitutes acceptance; discontinue use if you do not agree.
            </p>
          </Section>

          <Section title="19. Contact">
            <p>Email: Hussein@superfilm.info</p>
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
