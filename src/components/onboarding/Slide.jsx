// src/components/onboarding/Slide.jsx
import React from "react";
import "./onboarding.css";

export default function Slide({ title, body, note, image, isActive, ctaButton }) {
  const isTmdb = typeof image === "string" && image.includes("image.tmdb.org");
  const preloadHint = isTmdb ? { backgroundColor: "#0a0a0a" } : {};
  return (
    <div
      className={`onboard-slide ${isActive ? "active" : ""} ${isTmdb ? "tmdb-credit" : ""}`}
      style={{
        backgroundImage: `url(${image})`,
        ...preloadHint
      }}
    >
      <div className="onboard-overlay" />

      <div className="onboard-content">
        <h1 className="onboard-title">{title}</h1>
        <p className="onboard-body">{body}</p>

        {note && <p className="onboard-note">{note}</p>}
        {ctaButton ? <div className="onboard-cta-inline">{ctaButton}</div> : null}
      </div>
    </div>
  );
}
