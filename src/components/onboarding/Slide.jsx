// src/components/onboarding/Slide.jsx
import React from "react";
import "./onboarding.css";

export default function Slide({ title, body, note, image, isActive }) {
  const isTmdb = typeof image === "string" && image.includes("image.tmdb.org");
  return (
    <div
      className={`onboard-slide ${isActive ? "active" : ""} ${isTmdb ? "tmdb-credit" : ""}`}
      style={{
        backgroundImage: `url(${image})`
      }}
    >
      <div className="onboard-overlay" />

      <div className="onboard-content">
        <h1 className="onboard-title">{title}</h1>
        <p className="onboard-body">{body}</p>

        {note && <p className="onboard-note">{note}</p>}
      </div>
    </div>
  );
}
