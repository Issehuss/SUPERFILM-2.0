// src/components/onboarding/OnboardingTutorial.jsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import slides from "./slideData";
import Slide from "./Slide";
import "./onboarding.css";
import supabase from "../../supabaseClient";
import { useUser } from "../../context/UserContext";

export default function OnboardingTutorial() {
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const navigate = useNavigate();
  const { user } = useUser();

  const current = slides[index];
  const lastIndex = slides.length - 1;

  // Auto-rotate every 2s until the last slide
  useEffect(() => {
    if (finishing || index >= lastIndex) return;
    const t = setInterval(() => {
      setIndex((i) => {
        if (i >= lastIndex) return i;
        return i + 1;
      });
    }, 2000);
    return () => clearInterval(t);
  }, [index, lastIndex, finishing]);

  async function finishOnboarding() {
    setFinishing(true);

    // Update Supabase flag
    if (user) {
      const updates = [
        supabase
          .from("profiles")
          .update({ has_seen_onboarding: true })
          .eq("id", user.id),
        supabase.auth.updateUser({
          data: { has_seen_onboarding: true },
        }),
      ];

      await Promise.allSettled(updates);
    }
    try {
      localStorage.setItem("sf:onboarding_seen", "1");
    } catch (e) {
      // ignore storage errors
    }

    // Fade to black → then navigate
    setTimeout(() => {
      navigate("/clubs", { replace: true });
    }, 1000);
  }

  return (
    <div className="onboard-wrapper">
      {/* All Slides */}
      {slides.map((s, i) => (
        <Slide
          key={i}
          title={s.title}
          body={s.body}
          note={s.note}
          image={s.image}
          isActive={i === index}      // 🔥 only active slide shows
          ctaButton={
            s.cta && i === index ? (
              <button className="cta-btn inline" onClick={finishOnboarding}>
                Find a Club
              </button>
            ) : null
          }
        />
      ))}


      {/* Navigation */}
      <div className="onboard-controls">
        {index > 0 && (
          <button className="nav-arrow" onClick={() => setIndex(index - 1)}>
            ‹
          </button>
        )}

        <div className="dots">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`dot ${i === index ? "active-dot" : ""}`}
            />
          ))}
        </div>

        {index < slides.length - 1 ? (
          <button className="nav-arrow" onClick={() => setIndex(index + 1)}>
            ›
          </button>
        ) : null}
      </div>

      {/* Skip button for early slides */}
      {index < slides.length - 1 && (
        <button className="skip-btn" onClick={finishOnboarding}>
          Skip
        </button>
      )}

      {/* Fade to black ending */}
      {finishing && (
        <div className="fade-black">
          <span className="begin-text">Let’s begin.</span>
        </div>
      )}
    </div>
  );
}
