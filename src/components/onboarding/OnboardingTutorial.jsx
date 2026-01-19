// src/components/onboarding/OnboardingTutorial.jsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import slides from "./slideData";
import Slide from "./Slide";
import "./onboarding.css";
import usePageVisibility from "../../hooks/usePageVisibility";

export default function OnboardingTutorial() {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const isVisible = usePageVisibility();

  const current = slides[index];
  const lastIndex = slides.length - 1;

  // Preload slide images ASAP for faster first render
  useEffect(() => {
    const imgs = slides
      .map((s) => s.image)
      .filter(Boolean);
    imgs.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Auto-rotate every 2s until the last slide
  useEffect(() => {
    if (index >= lastIndex || !isVisible) return;
    const t = setInterval(() => {
      setIndex((i) => {
        if (i >= lastIndex) return i;
        return i + 1;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [index, lastIndex, isVisible]);

  async function finishOnboarding() {
    try {
      localStorage.setItem("sf:onboarding_seen", "1");
    } catch {
      // ignore storage errors
    }

    // Navigate immediately; fallback to hard redirect to avoid getting stuck
    navigate("/profile", { replace: true });
    setTimeout(() => {
      try {
        navigate("/profile", { replace: true });
      } catch {}
    }, 200);
    setTimeout(() => {
      try {
        window.location.assign("/profile");
      } catch {}
    }, 600);
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
                Set up your profile
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

    </div>
  );
}
