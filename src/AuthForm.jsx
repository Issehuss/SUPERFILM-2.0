import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSignup = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setMessage(error.message);
    else setMessage("Signed up successfully!");
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else setMessage("Logged in!");
  };

  return (
    <div className="flex flex-col gap-2 p-4 bg-zinc-900 rounded-lg w-80">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="p-2 rounded bg-zinc-800 text-white"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="p-2 rounded bg-zinc-800 text-white"
      />

      <button onClick={handleSignup} className="bg-yellow-500 text-black p-2 rounded">
        Sign Up
      </button>
      <button onClick={handleLogin} className="bg-green-500 text-black p-2 rounded">
        Log In
      </button>

      <p className="text-sm text-zinc-400 mt-2">{message}</p>
    </div>
  );
}
