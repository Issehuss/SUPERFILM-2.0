// src/pages/AuthPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabaseClient.js";
import { useSearchParams } from "react-router-dom";

export default function AuthPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'success' | 'error', text: string } | null
  const [search] = useSearchParams();
const initialMode = search.get("mode") === "signup" ? "signup" : "signin";


  const handleSignIn = async (e) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // ⚡ instant navigate; UserContext hydrates in the background
      navigate("/myclub", { replace: true });
    } catch (err) {
      setMsg({ type: "error", text: err?.message || "Sign-in failed." });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setMsg({
        type: "success",
        text: "Check your email to confirm your account. After confirming, return here to sign in.",
      });
      setMode("signin");
    } catch (err) {
      setMsg({ type: "error", text: err?.message || "Sign-up failed." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <form
        onSubmit={mode === "signin" ? handleSignIn : handleSignUp}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-white"
      >
        <h1 className="text-2xl font-bold mb-4">
          {mode === "signin" ? "Sign in to SuperFilm" : "Create your SuperFilm account"}
        </h1>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 rounded-lg bg-zinc-800 px-3 py-2 outline-none ring-1 ring-zinc-700 focus:ring-yellow-500"
          placeholder="you@example.com"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 rounded-lg bg-zinc-800 px-3 py-2 outline-none ring-1 ring-zinc-700 focus:ring-yellow-500"
          placeholder="••••••••"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className={`w-full rounded-lg px-4 py-2 font-semibold ${
            loading ? "bg-yellow-700 cursor-wait" : "bg-yellow-500 hover:bg-yellow-400 text-black"
          }`}
        >
          {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>

        {msg && (
          <div className={`mt-3 text-sm ${msg.type === "error" ? "text-red-400" : "text-green-400"}`}>
            {msg.text}
          </div>
        )}

        <div className="mt-4 text-sm text-zinc-400">
          {mode === "signin" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-yellow-400 hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-yellow-400 hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}


