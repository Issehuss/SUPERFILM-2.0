/// src/pages/PremiumPage.jsx
import { useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { startCheckout } from "../lib/billing";

export default function PremiumPage() {
  const { isPremium, refreshProfile } = useUser();
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  // Refresh profile on mount (useful after returning from Stripe)
  useEffect(() => { refreshProfile?.(); }, [refreshProfile]);

  // If the user just subscribed elsewhere and lands here while already premium,
  // bounce them back to where they came from (if ?from= is present)
  useEffect(() => {
    if (!isPremium) return;
    const from = sp.get("from");
    if (from) navigate(from, { replace: true });
  }, [isPremium, sp, navigate]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at top, rgba(255,215,0,0.18), transparent 60%)",
          }}
        />
        <div className="mx-auto max-w-6xl px-6 pt-16 pb-10">
          <div className="inline-flex items-center rounded-2xl bg-gradient-to-br from-yellow-300 to-amber-500 px-4 py-2 font-semibold text-black shadow-[0_0_30px_rgba(255,200,0,0.35)] ring-1 ring-yellow-300/60">
            Director’s Cut
          </div>
          <h1 className="mt-6 text-4xl md:text-5xl font-extrabold tracking-tight">
            SuperFilm Premium Director’s Cut
          </h1>
          <p className="mt-4 max-w-2xl text-zinc-300">
            Shape your cinematic identity with more creativity, style, and freedom.
          </p>

          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={startCheckout}
              className="inline-flex items-center justify-center rounded-2xl px-6 py-3 font-semibold text-black bg-gradient-to-br from-yellow-300 to-amber-500 shadow-[0_0_30px_rgba(255,200,0,0.35)] ring-1 ring-yellow-300/60 hover:scale-[1.02] transition"
            >
              Subscribe £3 per month
            </button>
            <Link
              to="#subscribe"
              className="rounded-xl px-4 py-2 bg-zinc-800/70 hover:bg-zinc-700/70 text-zinc-200 ring-1 ring-white/10 transition"
            >
              See what’s included
            </Link>
          </div>
        </div>
      </section>

      {/* Profile and Aesthetic Perks */}
      <Section
        title="Profile and Aesthetic Perks"
        subtitle="Make your profile feel truly cinematic."
      >
        <Feature tone="rose" title="Unlimited Moodboard Space">
          Go beyond six tiles and build expansive visual collages of stills, quotes, and colours.
        </Feature>
        <Feature tone="sky" title="Dynamic Profile Themes">
          Unlock extra visual themes inspired by cinema movements and moods such as Neon Nights and Golden Age Noir.
        </Feature>
        <Feature tone="emerald" title="More Glow and Outline Styles">
          Expand your Taste Card palette with rare glow effects and outlines.
        </Feature>
        <Feature tone="violet" title="Create Your Own Taste Cards">
          Write and design custom film questions that reflect your unique perspective.
        </Feature>
        <Feature tone="amber" title="Custom Film Rating Tags">
          Replace stars with your own system such as Popcorn Classic, Emotional Damage, or Masterpiece. Configure per profile.
        </Feature>
      </Section>

      {/* Club and Community Features */}
      <Section
        title="Club and Community Features"
        subtitle="Tools that help your community flourish."
      >
        <Feature tone="indigo" title="Private Clubs">
          Presidents can switch clubs to invite only for a more intimate space.
        </Feature>
        <Feature tone="fuchsia" title="Club Analytics Dashboard">
          Track member growth, activity, and engagement in a clean overview.
        </Feature>
        <Feature tone="orange" title="Exclusive Polls and Events Coming Soon">
          Host members-only screenings and polls with staged rollout.
        </Feature>
      </Section>

      {/* Experience and Early Access */}
      <Section title="Experience and Early Access" subtitle="Faster, cleaner, earlier.">
        <Feature tone="lime" title="No Ads Ever">
          Enjoy a clean and uninterrupted experience across SuperFilm.
        </Feature>
        <Feature tone="pink" title="Early Access to New Features">
          Get upcoming tools and releases a week before most users.
        </Feature>
        <Feature tone="cyan" title="Premium Badge">
          A subtle Director’s Cut mark of distinction on your profile and posts.
        </Feature>
      </Section>

      {/* Future Perks */}
      <Section
        title="Future Perks Already in the Works"
        subtitle="Your membership funds rapid iteration."
      >
        <Feature tone="yellow" title="Year in Review Deep Dive">
          A visual look back at your year in film with richer stats and insights.
        </Feature>
        <Feature tone="red" title="Taste Match Quiz">
          Discover clubs and users that share your sensibilities.
        </Feature>
        <Feature tone="purple" title="Animated Banners and Film Grain Frames">
          Add subtle cinematic motion and texture to your profile.
        </Feature>
      </Section>

      {/* Pricing */}
      <section id="subscribe" className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold">Director’s Cut</h3>
              <p className="mt-1 text-zinc-400">£3 per month · cancel anytime · no ads</p>
            </div>
            <button
              onClick={startCheckout}
              className="inline-flex items-center justify-center rounded-2xl px-6 py-3 font-semibold text-black bg-gradient-to-br from-yellow-300 to-amber-500 shadow-[0_0_30px_rgba(255,200,0,0.35)] ring-1 ring-yellow-300/60 hover:scale-[1.02] transition"
            >
              Continue £3 per month
            </button>
          </div>
        </div>
      </section>

      {/* Final Note */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 md:p-8">
          <h4 className="text-lg font-semibold">A Note from the Team</h4>
          <p className="mt-3 text-zinc-300 leading-relaxed">
            SuperFilm is built by an independent grassroots collective made up of a couple of film lovers with big dreams for this platform.
            Every subscription directly fuels new features, helps us grow, and keeps SuperFilm bold, imaginative, and independent.
            We truly appreciate every time someone opens SuperFilm, invites a friend or recommends us — without you, we can’t transform SuperFilm into the platform we know it can be. Thank you.
          </p>
        </div>
      </section>
    </div>
  );
}

/* ---------- Building blocks ---------- */

function Section({ title, subtitle, children }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-bold">{title}</h2>
        {subtitle && <p className="mt-1 text-zinc-400">{subtitle}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function Feature({ title, children, tone = "amber" }) {
  const toneToGradient = {
    rose: "from-rose-500 to-orange-400",
    sky: "from-sky-400 to-cyan-500",
    emerald: "from-emerald-400 to-lime-500",
    violet: "from-violet-400 to-indigo-500",
    amber: "from-amber-400 to-yellow-500",
    indigo: "from-indigo-400 to-blue-500",
    fuchsia: "from-fuchsia-500 to-pink-500",
    teal: "from-teal-400 to-emerald-500",
    orange: "from-orange-400 to-amber-500",
    lime: "from-lime-400 to-emerald-500",
    pink: "from-pink-400 to-rose-500",
    cyan: "from-cyan-400 to-sky-500",
    yellow: "from-yellow-400 to-amber-500",
    red: "from-red-500 to-orange-500",
    purple: "from-purple-400 to-fuchsia-500",
  }[tone];

  return (
    <div className={`rounded-2xl p-[1px] bg-gradient-to-br ${toneToGradient} transition`}>
      <div className="group rounded-[15px] border border-zinc-900 bg-zinc-950/70 p-5 hover:bg-zinc-900/70 transition">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-zinc-300">{children}</p>
      </div>
    </div>
  );
}
