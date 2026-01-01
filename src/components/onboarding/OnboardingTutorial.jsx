// src/components/onboarding/OnboardingTutorial.jsx

import React, { useState } from "react";
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

  async function finishOnboarding() {
    setFinishing(true);

    // Update Supabase flag
    if (user) {
      await supabase
        .from("profiles")
        .update({ has_seen_onboarding: true })
        .eq("id", user.id);
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

      {/* CTA button on final slide */}
      {current.cta && (
        <button className="cta-btn" onClick={finishOnboarding}>
          Find a Club
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
