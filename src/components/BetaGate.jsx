// src/components/BetaGate.jsx
import React, { useEffect, useMemo, useState } from "react";
import { env } from "../lib/env";
import { useUser } from "../context/UserContext";
import "./BetaGate.css";

const TOKEN_KEY = "sf.beta.token";

const fingerprint = (value) => {
  if (!value) return "";
  try {
    return btoa(value);
  } catch {
    return value;
  }
};

export default function BetaGate({ children }) {
  const betaPass = useMemo(() => (env.BETA_PASSWORD || "").trim(), []);
  const bypass = env.BETA_BYPASS;
  const isDev = env.IS_DEV;
  const userCtx = useUser() || {};
  const isPartner = userCtx?.isPartner || false;

  const [allowed, setAllowed] = useState(false);
  const [input, setInput] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [forceGate, setForceGate] = useState(false);
  const [handoff, setHandoff] = useState(false);

  useEffect(() => {
    if (!betaPass || bypass) {
      setAllowed(true);
      return;
    }

    try {
      const cached =
        localStorage.getItem(TOKEN_KEY) ||
        sessionStorage.getItem(TOKEN_KEY);
      if (cached && cached === fingerprint(betaPass)) {
        setAllowed(true);
      }
    } catch {
      // ignore
    }
  }, [betaPass, bypass]);

  const showGate = !!betaPass && (!allowed || forceGate);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) {
      setError("Enter the beta password.");
      return;
    }
    if (input.trim() !== betaPass) {
      setError("Incorrect password.");
      return;
    }

    const token = fingerprint(input.trim());
    try {
      const store = remember ? localStorage : sessionStorage;
      store.setItem(TOKEN_KEY, token);
    } catch {
      // best-effort only
    }
    setAllowed(true);
    setForceGate(false);
    setHandoff(true);
    setTimeout(() => setHandoff(false), 1800);
    try {
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.location.replace("/");
      }
    } catch {
      // ignore redirect failures
    }
  };

  const onReset = () => {
    setInput("");
    setError("");
  };

  // Show the peek button only to SuperFilm partners
  const canPeek = !!isPartner;

  if (!showGate) {
    return (
      <>
        {children}
        {canPeek && (
          <button
            className="beta-gate__peek"
            type="button"
            onClick={() => {
              setForceGate(true);
              setInput("");
              setError("");
            }}
          >
            View beta gate
          </button>
        )}
        {handoff && (
          <div className="beta-gate__handoff" role="status" aria-live="polite">
            <div className="beta-gate__handoff-card">
              <div className="beta-gate__spinner" aria-hidden />
              <div>
                <div className="beta-gate__handoff-title">Loading SuperFilm…</div>
                <div className="beta-gate__handoff-sub">
                  Preparing your session.
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="beta-gate">
      <div className="beta-gate__bg" />
      <div className="beta-gate__glass">
        <div className="beta-gate__logo">
          <div>
            <div className="beta-gate__brand">SuperFilm</div>
            <div className="beta-gate__tagline">Private beta access</div>
          </div>
        </div>

        <div className="beta-gate__headline">
          Enter the beta password to continue
        </div>
        <div className="beta-gate__sub">
          This keeps our preview private while we test. Your session stays
          unlocked on this device{remember ? " until you clear it" : ""}.
        </div>

        <form onSubmit={onSubmit} className="beta-gate__form">
          <label className="beta-gate__field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="off"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError("");
              }}
              placeholder="••••••••"
            />
          </label>

          <label className="beta-gate__remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>Remember me on this device</span>
          </label>

          {error ? <div className="beta-gate__error">{error}</div> : null}

          <div className="beta-gate__actions">
            <button type="button" className="btn ghost" onClick={onReset}>
              Clear
            </button>
            <button type="submit" className="btn primary">
              Unlock
            </button>
          </div>
        </form>

        <div className="beta-gate__hint">
          Need the password? Ask the SuperFilm team at{" "}
          <a href="mailto:hussein@superfilm.info" className="beta-gate__link">
            hussein@superfilm.info
          </a>{" "}
          or{" "}
          <a href="mailto:kacper@superfilm.info" className="beta-gate__link">
            kacper@superfilm.info
          </a>
          .
        </div>
      </div>
    </div>
  );
}
