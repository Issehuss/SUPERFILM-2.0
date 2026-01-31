// src/pages/DirectorsCutSuccess.jsx
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/UserContext";
import { trackEvent } from "../lib/analytics";

export default function DirectorsCutSuccess() {
  const { refreshProfile, profile, isPremium } = useUser();
  const navigate = useNavigate();
  const firedRef = useRef(false);

  useEffect(() => {
    refreshProfile?.({ force: true });
    const timer = setTimeout(() => navigate("/settings/premium?upgraded=1", { replace: true }), 1200);
    return () => clearTimeout(timer);
  }, [refreshProfile, navigate]);

  useEffect(() => {
    if (firedRef.current) return;
    if (!isPremium) return;
    trackEvent("trial_converted", {
      days_used: 0, // placeholder per instruction
      plan: profile?.plan || "directors_cut",
    });
    firedRef.current = true;
  }, [isPremium, profile?.plan]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-bold">Your 14-day free trial has started.</h1>
        <p className="mt-3 text-zinc-300">Welcome to Director’s Cut.</p>
      </div>
    </div>
  );
}
