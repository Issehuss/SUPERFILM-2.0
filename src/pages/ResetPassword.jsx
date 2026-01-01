// src/pages/ResetPassword.jsx

import React, { useState } from "react";
import supabase from "../supabaseClient";

export default function ResetPassword() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleUpdate = async () => {
    setError("");

    if (pw.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (pw !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: pw });

    if (error) {
      setError(error.message);
    } else {
      setDone(true);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 shadow-[0_0_50px_rgba(255,230,0,0.15)]">
        {/* Success panel */}
        {done ? (
          <div className="text-center text-white">
            <h1 className="text-3xl font-bold text-yellow-400 mb-4">
              Password Updated
            </h1>
            <p className="text-zinc-300 mb-8">
              You can now sign in with your new password.
            </p>
            <a
              href="/auth"
              className="px-6 py-3 bg-yellow-400 text-black rounded-lg font-semibold hover:scale-105 transition"
            >
              Return to Sign In
            </a>
          </div>
        ) : (
          <>
            {/* Header */}
            <h1 className="text-3xl font-bold text-yellow-400 text-center mb-2">
              Set a New Password
            </h1>
            <p className="text-zinc-400 text-center mb-8">
              Choose a strong password for your SuperFilm account.
            </p>

            {/* Inputs */}
            <div className="space-y-5">
              <div>
                <label className="text-zinc-300 text-sm">New Password</label>
                <input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  className="mt-1 w-full p-3 rounded-lg bg-black/40 border border-yellow-500/40 text-white focus:border-yellow-400 outline-none transition"
                />
              </div>

              <div>
                <label className="text-zinc-300 text-sm">Confirm Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1 w-full p-3 rounded-lg bg-black/40 border border-yellow-500/40 text-white focus:border-yellow-400 outline-none transition"
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <p className="mt-4 text-red-400 text-sm font-medium">{error}</p>
            )}

            {/* Button */}
            <button
              onClick={handleUpdate}
              className="mt-8 w-full py-3 bg-yellow-400 text-black rounded-lg font-bold hover:scale-105 active:scale-95 transition"
            >
              Update Password
            </button>
          </>
        )}
      </div>
    </div>
  );
}
