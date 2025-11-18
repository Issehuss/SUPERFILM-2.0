// src/pages/CreateClubWizard.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabaseClient.js";
import { useUser } from "../context/UserContext";

const ROLE = { PRESIDENT: "president" };

/* --------------------------------
   Helpers
--------------------------------- */
const slugify = (s) =>
  (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);

// TMDB helpers
function tmdbUrl(size, path) {
  // size: w300, w780, w1280, original
  // path: '/abc123.jpg'
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

function normalizeTmdbPath(input) {
  if (!input) return "";
  try {
    if (input.startsWith("http")) {
      const u = new URL(input);
      const filename = u.pathname.split("/").pop() || "";
      return `/${filename}`;
    }
    return input.startsWith("/") ? input : `/${input}`;
  } catch {
    return input.startsWith("/") ? input : `/${input}`;
  }
}

/* --------------------------------
   Backdrops (HD — TMDB paths)
   (Use only the filename path; the component builds size-specific URLs)
--------------------------------- */
const BACKDROPS = [
  "/8AUJ6a638gLWVgBMMUHLriUgAxG.jpg",
  "/vAsxVpXP53cMSsD9u4EekQKz4ur.jpg",
  "/wEF0ENqmkbCMJ47yDRf1vQ4VKve.jpg",
  "/jONSbZ92K3tvDEsYrBuog5DW1KL.jpg",
  "/iimkH5M5VfkIegy68LrJiFXOnza.jpg",
  "/A9KPbYTQvWsp51Lgz85ukVkFrKf.jpg",
  "/jZj6cGNWxggM5tA6hDxPAuqzv5I.jpg",
  "/h1GIFzevCInehjALUltUOJNdO9S.jpg",
  "/u5dQ0RsvHTGbghnni4cWR1EoIOu.jpg",
  "/4y7rMDjSyYMdWDf0P76VUMngf4d.jpg",
  "/hS5P3ktQO8tk6YoVq2kKwaV7rGS.jpg",
  "/xOuhhbQ3Nzznt5MjRdLBJb0CmDE.jpg",
  "/muY69LawUjeZtQ7l2cfhUbKZOY4.jpg",
  "/59ur074TVZ13QuQvRcubrEB3Izf.jpg",
];

/* --------------------------------
   Ultra-sharp responsive backdrop with LQIP → hi-res fade
--------------------------------- */
const loadedHiRes = new Set();
function CinematicBackdrop({ path, priority = false, objectPosition = "50% 50%" }) {
  const safePath = useMemo(() => normalizeTmdbPath(path), [path]);
  const low = useMemo(() => tmdbUrl("w300", safePath), [safePath]);
  const src780 = useMemo(() => tmdbUrl("w780", safePath), [safePath]);
  const src1280 = useMemo(() => tmdbUrl("w1280", safePath), [safePath]);
  const srcOriginal = useMemo(() => tmdbUrl("original", safePath), [safePath]);

  const [hiReady, setHiReady] = useState(
    loadedHiRes.has(src1280) || loadedHiRes.has(srcOriginal)
  );

  useEffect(() => {
    const img = new Image();
    img.src = src1280;
    // @ts-ignore
    img.fetchPriority = priority ? "high" : "auto";
    const done = () => {
      loadedHiRes.add(src1280);
      setHiReady(true);
    };
    if (img.decode) {
      img.decode().then(done).catch(() => (img.onload = done));
    } else {
      img.onload = done;
    }

    // Opportunistically warm original for very large / Hi-DPI screens
    if ((window.devicePixelRatio || 1) > 1.4 || window.innerWidth > 1440) {
      const o = new Image();
      o.src = srcOriginal;
    }
  }, [src1280, srcOriginal, priority]);

  return (
    <div className="absolute inset-0">
      {/* Instant LQIP layer */}
      <img
        src={low}
        alt=""
        className="absolute inset-0 w-full h-full object-cover scale-[1.02]"
        style={{ objectPosition, filter: "blur(12px)", transform: "translateZ(0)" }}
        loading={priority ? "eager" : "lazy"}
        fetchpriority={priority ? "high" : "auto"}
        decoding="async"
        draggable={false}
      />

      {/* Responsive hi-res with original in srcset */}
      <img
        src={src1280}
        alt=""
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
        style={{ objectPosition, opacity: hiReady ? 1 : 0, willChange: "opacity" }}
        loading={priority ? "eager" : "lazy"}
        fetchpriority={priority ? "high" : "auto"}
        decoding="async"
        draggable={false}
        srcSet={`${src780} 780w, ${src1280} 1280w, ${srcOriginal} 2560w`}
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/40 to-black/30" />
    </div>
  );
}

/* --------------------------------
   Component
--------------------------------- */
export default function CreateClubWizard() {
  const navigate = useNavigate();
  const { user } = useUser();

  // Steps: 1 name, 2 tagline, 3 about, 4 location, 5 tone-film (optional), 6 welcome + launch
  const FIRST_STEP = 1;
  const LAST_STEP = 6;
  const [step, setStep] = useState(FIRST_STEP);

  // Form state
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [about, setAbout] = useState("");
  const [location, setLocation] = useState("");

  // Tone-setting film (optional)
  const [toneFilmTmdbId, setToneFilmTmdbId] = useState("");
  const [toneFilmTitle, setToneFilmTitle] = useState("");

  // Welcome message (optional)
  const [welcomeMessage, setWelcomeMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Preload backdrops (just prime the cache; LQIP ensures instant paint)
  useEffect(() => {
    BACKDROPS.slice(0, 4).forEach((p) => {
      const img = new Image();
      img.src = tmdbUrl("w780", normalizeTmdbPath(p));
    });
  }, []);

  const backdrop = useMemo(() => BACKDROPS[(step - 1) % BACKDROPS.length], [step]);

  // Validation per step
  const canGoNext = useMemo(() => {
    if (step === 1) return !!name.trim();
    if (step === 2) return !!tagline.trim();
    if (step === 3) return !!about.trim();
    if (step === 4) return !!location.trim();
    // 5 tone film optional
    // 6 final submit
    return true;
  }, [step, name, tagline, about, location]);

  const next = useCallback(() => {
    if (step < LAST_STEP && canGoNext) setStep((s) => s + 1);
  }, [step, canGoNext]);

  const back = useCallback(() => {
    if (step > FIRST_STEP) setStep((s) => s - 1);
  }, [step]);

  // Allow Enter to advance
  const onEnterAdvance = (e) => {
    if (e.key === "Enter" && canGoNext && step < LAST_STEP) {
      e.preventDefault();
      next();
    }
  };

  /* --------------------------------
     DB helpers (RLS-aware)
  --------------------------------- */
  async function createClubRow(payload) {
    // Prefer returning
    const { data, error } = await supabase
      .from("clubs")
      .insert(payload)
      .select("id, slug")
      .single();

    if (error) {
      // Fallback: plain insert then lookup
      const { error: insErr } = await supabase.from("clubs").insert(payload);
      if (insErr) throw insErr;

      const { data: lookup } = await supabase
        .from("clubs")
        .select("id, slug")
        .eq("owner_id", payload.owner_id)
        .eq("slug", payload.slug)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return lookup ?? { id: null, slug: payload.slug, _fallback: true };
    }

    return data;
  }

  async function upsertPresidentMembership(clubId, userId) {
    if (!clubId || !userId) return;
    const { error } = await supabase
      .from("club_members")
      .upsert(
        { club_id: clubId, user_id: userId, role: ROLE.PRESIDENT },
        { onConflict: "club_id,user_id" }
      );
    if (error && error.code !== "23505") {
      console.warn("[club_members upsert] ", error.message);
    }
  }

  /* --------------------------------
     Submit
  --------------------------------- */
  async function handleCreate() {
    if (submitting) return;

    // Final guard — jump to first missing
    if (!name || !tagline || !about || !location) {
      alert("Please complete the required steps first.");
      if (!name) setStep(1);
      else if (!tagline) setStep(2);
      else if (!about) setStep(3);
      else if (!location) setStep(4);
      return;
    }

    if (!user?.id) {
      navigate("/auth");
      return;
    }

    setSubmitting(true);
    try {
      const safeName = name.trim();
      const safeSlug = slugify(safeName);

      // Lightweight cache (optional)
      try {
        const wizardCache = {
          toneFilm: toneFilmTmdbId
            ? { tmdb_id: toneFilmTmdbId, title: toneFilmTitle || null }
            : null,
          createdAt: Date.now(),
        };
        localStorage.setItem("clubWizard:lastPayload", JSON.stringify(wizardCache));
      } catch {
        // ignore
      }

      const payload = {
        name: safeName,
        slug: safeSlug,
        tagline: tagline.trim(),
        about: about.trim(),
        location: location.trim(),
        owner_id: user.id,
        is_published: false,
        welcome_message: (welcomeMessage || "").trim() || null,
      };

      const created = await createClubRow(payload);
      const clubId = created?.id ?? null;
      const clubSlug = created?.slug ?? safeSlug;

      if (clubId) {
        await upsertPresidentMembership(clubId, user.id);
      }

      try {
        if (clubId) localStorage.setItem("activeClubId", String(clubId));
        if (clubSlug) localStorage.setItem("activeClubSlug", clubSlug);
      } catch {}

      navigate(`/clubs/${clubSlug}`, { replace: true });
    } catch (e) {
      console.error("[CreateClubWizard] create failed:", e);
      alert(e?.message || "Could not create club.");
    } finally {
      setSubmitting(false);
    }
  }

  /* --------------------------------
     Styling helpers
  --------------------------------- */
  const inputCls =
    "w-full p-4 rounded-lg bg-zinc-900 border border-yellow-500/60 focus:border-yellow-400 outline-none transition";
  const textAreaCls =
    "w-full p-4 rounded-lg bg-zinc-900 border border-yellow-500/60 focus:border-yellow-400 outline-none transition";

  return (
    <div className="min-h-screen text-white bg-black" onKeyDown={onEnterAdvance}>
      {/* Inline CSS: vertical breathing motion */}
      <style>{`
        @keyframes sf-breathe-y {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
          100% { transform: translateY(0px); }
        }
        .sf-breathe-y {
          animation: sf-breathe-y 5.5s ease-in-out infinite;
          will-change: transform;
        }
      `}</style>

      <div className="mx-auto max-w-6xl pt-8 pb-16">
        <div className="relative overflow-hidden rounded-3xl border-4 border-white/20 shadow-2xl -mx-6 w-[calc(100%+3rem)] min-h-[1120px]">
          {/* HD backdrop with LQIP → hi-res fade */}
          <CinematicBackdrop path={backdrop} priority objectPosition="50% 50%" />

          {/* Wizard Card */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-black/70 backdrop-blur-sm border border-white/15 rounded-2xl p-8 shadow-xl">
              {/* Header */}
              <header className="mb-8 text-center">
                <h1 className="sf-breathe-y text-3xl md:text-4xl font-bold">
                  🎬 Create Your Club
                </h1>
                <p className="sf-breathe-y mt-2 text-sm text-zinc-300">
                  Step {step} of {LAST_STEP}
                </p>
              </header>

              {/* Step 1: Name */}
              {step === 1 && (
                <>
                  <div className="mb-2 text-sm text-zinc-300">
                    <span className="font-semibold">Q:</span> What will you call your club?
                  </div>
                  <input
                    className={inputCls}
                    placeholder="e.g., Southbank Thursday Classics"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-label="Club name"
                    autoFocus
                  />
                  <div className="mt-2 text-xs text-zinc-400">
                    Slug preview:{" "}
                    <span className="text-zinc-200">/clubs/{slugify(name) || "your-club"}</span>
                  </div>
                  <div className="mt-6 text-right">
                    <button
                      disabled={!canGoNext}
                      onClick={next}
                      className="bg-yellow-500 px-6 py-2 text-black rounded-full font-semibold disabled:opacity-60"
                    >
                      Next →
                    </button>
                  </div>
                </>
              )}

              {/* Step 2: Tagline */}
              {step === 2 && (
                <>
                  <div className="mb-2 text-sm text-zinc-300">
                    <span className="font-semibold">Q:</span> What’s your short tagline?
                  </div>
                  <input
                    className={inputCls}
                    placeholder="e.g., World cinema every Thursday night"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    aria-label="Club tagline"
                    autoFocus
                  />
                  <div className="mt-6 flex justify-between">
                    <button onClick={back} className="text-zinc-300 hover:text-white">
                      ← Back
                    </button>
                    <button
                      disabled={!canGoNext}
                      onClick={next}
                      className="bg-yellow-500 px-6 py-2 text-black rounded-full font-semibold disabled:opacity-60"
                    >
                      Next →
                    </button>
                  </div>
                </>
              )}

              {/* Step 3: About */}
              {step === 3 && (
                <>
                  <div className="mb-2 text-sm text-zinc-300">
                    <span className="font-semibold">Q:</span> What is your club about?
                  </div>
                  <textarea
                    className={`${textAreaCls} h-32`}
                    placeholder="Tell people the vibe, focus, and what to expect."
                    value={about}
                    onChange={(e) => setAbout(e.target.value)}
                    aria-label="About the club"
                    autoFocus
                  />
                  <div className="mt-6 flex justify-between">
                    <button onClick={back} className="text-zinc-300 hover:text-white">
                      ← Back
                    </button>
                    <button
                      disabled={!canGoNext}
                      onClick={next}
                      className="bg-yellow-500 px-6 py-2 text-black rounded-full font-semibold disabled:opacity-60"
                    >
                      Next →
                    </button>
                  </div>
                </>
              )}

              {/* Step 4: Location */}
              {step === 4 && (
                <>
                  <div className="mb-2 text-sm text-zinc-300">
                    <span className="font-semibold">Q:</span> Where does your club meet?
                  </div>
                  <input
                    className={inputCls}
                    placeholder="City or area (type 'Online' if virtual)"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    aria-label="Club location"
                    autoFocus
                  />
                  <div className="mt-6 flex justify-between">
                    <button onClick={back} className="text-zinc-300 hover:text-white">
                      ← Back
                    </button>
                    <button
                      disabled={!canGoNext}
                      onClick={next}
                      className="bg-yellow-500 px-6 py-2 text-black rounded-full font-semibold disabled:opacity-60"
                    >
                      Next →
                    </button>
                  </div>
                </>
              )}

              {/* Step 5: Tone-setting film (optional) */}
              {step === 5 && (
                <>
                  <div className="mb-2 text-sm text-zinc-300">
                    <span className="font-semibold">Q:</span> (Optional) Is there a film that sets your club’s tone?
                  </div>
                  <input
                    className={inputCls}
                    placeholder="TMDB film ID or link (optional)"
                    value={toneFilmTmdbId}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      const m = v.match(/(\d{2,})/);
                      setToneFilmTmdbId(m ? m[1] : v);
                    }}
                    aria-label="TMDB id or link"
                    autoFocus
                  />
                  <input
                    className={`${inputCls} mt-3`}
                    placeholder="Film title (optional)"
                    value={toneFilmTitle}
                    onChange={(e) => setToneFilmTitle(e.target.value)}
                    aria-label="Optional film title"
                  />
                  <div className="mt-6 flex justify-between">
                    <button onClick={back} className="text-zinc-300 hover:text-white">
                      ← Back
                    </button>
                    <button
                      onClick={next}
                      className="bg-yellow-500 px-6 py-2 text-black rounded-full font-semibold"
                    >
                      Next →
                    </button>
                  </div>
                </>
              )}

              {/* Step 6: Welcome + Launch */}
              {step === 6 && (
                <>
                  <div className="mb-2 text-sm text-zinc-300">
                    <span className="font-semibold">Q:</span> (Optional) What welcome message should new members receive?
                  </div>
                  <textarea
                    className={`${textAreaCls} h-28`}
                    placeholder="Welcome to the club! We usually meet Thursdays at 7pm. Introduce yourself in the chat ✨"
                    value={welcomeMessage}
                    onChange={(e) => setWelcomeMessage(e.target.value)}
                    aria-label="Welcome message"
                    autoFocus
                  />
                  <div className="flex justify-between items-center">
                    <button onClick={back} className="text-zinc-300 hover:text-white">
                      ← Back
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={submitting}
                      className="bg-yellow-400 text-black font-bold text-lg px-8 py-3 rounded-full shadow-[0_0_40px_rgba(255,220,120,0.4)] hover:scale-105 active:scale-95 transition disabled:opacity-40"
                      aria-label="Create club"
                    >
                      {submitting ? "Projector Warming Up…" : "🎞️ Launch This Film Club"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Credit */}
          <div className="absolute bottom-2 right-3 text-[10px] text-white/70">
            Images via TMDB
          </div>
        </div>
      </div>
    </div>
  );
}
