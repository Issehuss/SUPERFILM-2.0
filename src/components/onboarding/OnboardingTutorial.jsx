// src/components/onboarding/OnboardingTutorial.jsx

import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import slides from "./slideData";
import Slide from "./Slide";
import "./onboarding.css";
import usePageVisibility from "../../hooks/usePageVisibility";
import { useUser } from "../../context/UserContext";
import supabase from "lib/supabaseClient";

export default function OnboardingTutorial() {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const isVisible = usePageVisibility();
  const { user } = useUser();

  const searchParams = new URLSearchParams(location.search);
  const isReplay = searchParams.get("replay") === "1";
  const handleFinish = () => {
    if (isReplay) {
      navigate("/", { replace: true });
      return;
    }
    finishOnboarding();
  };

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
    if (!isVisible) return;
    const t = setTimeout(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 5000);
    return () => clearTimeout(t);
  }, [index, isVisible]);

  async function finishOnboarding() {
    try {
      localStorage.setItem("sf:onboarding_seen", "1");
    } catch {
      // ignore storage errors
    }
    if (user) {
      try {
        await supabase.auth.updateUser({
          data: {
            ...(user.user_metadata || {}),
            onboarding_seen: true,
          },
        });
      } catch (err) {
        console.error("[Onboarding] failed to persist metadata:", err);
      }
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

  const [seenLocal, setSeenLocal] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setSeenLocal(localStorage.getItem("sf:onboarding_seen") === "1");
    } catch {
      setSeenLocal(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (isReplay) return;
    if (seenLocal || Boolean(user.user_metadata?.onboarding_seen)) {
      navigate("/", { replace: true });
    }
  }, [isReplay, seenLocal, user, navigate]);

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
              <button className="cta-btn inline" onClick={handleFinish}>
                {isReplay ? "Take me home" : "Set up your profile"}
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
        <button className="skip-btn" onClick={handleFinish}>
          Skip
        </button>
      )}

    </div>
  );
}
