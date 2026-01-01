// src/pages/ForgotPassword.jsx

import React, { useState } from "react";
import supabase from "../supabaseClient";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: "http://localhost:3000/auth/reset",
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 shadow-[0_0_50px_rgba(255,230,0,0.15)]">
        {sent ? (
          <div className="text-center text-white">
            <h1 className="text-3xl font-bold text-yellow-400 mb-4">
              Check your inbox
            </h1>
            <p className="text-zinc-300 mb-8">
              If an account exists for <span className="font-semibold">{email}</span>, 
              we’ve sent a password reset link.
            </p>
            <a
              href="/auth"
              className="px-6 py-3 bg-yellow-400 text-black rounded-lg font-semibold hover:scale-105 transition"
            >
              Back to sign in
            </a>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-yellow-400 text-center mb-2">
              Forgot your password?
            </h1>
            <p className="text-zinc-400 text-center mb-8">
              Enter the email you use for SuperFilm and we’ll send you a reset link.
            </p>

            <div>
              <label className="text-zinc-300 text-sm">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full p-3 rounded-lg bg-black/40 border border-yellow-500/40 text-white focus:border-yellow-400 outline-none transition"
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <p className="mt-4 text-red-400 text-sm font-medium">{error}</p>
            )}

            <button
              onClick={handleReset}
              disabled={loading}
              className="mt-8 w-full py-3 bg-yellow-400 text-black rounded-lg font-bold hover:scale-105 active:scale-95 transition disabled:opacity-60"
            >
              {loading ? "Sending link…" : "Send reset link"}
            </button>

            <div className="mt-6 text-center">
              <a
                href="/auth"
                className="text-sm text-zinc-400 hover:text-zinc-200 underline-offset-4 hover:underline"
              >
                Back to sign in
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
