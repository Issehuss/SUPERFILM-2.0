// src/dev/SupabasePing.jsx
import { useEffect, useState } from "react";
// ✅ Correct path & default import
import supabase from "lib/supabaseClient";

export default function SupabasePing() {
  const [authStatus, setAuthStatus] = useState("Checking…");
  const [dbStatus,   setDbStatus]   = useState("Checking…");
  const [details,    setDetails]    = useState("");

  useEffect(() => {
    (async () => {
      // 1) AUTH PING — are we signed in?
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          setAuthStatus("❌ Auth error");
          setDetails((d) => d + `\nAuth error: ${error.message}`);
        } else {
          setAuthStatus(
            data?.user ? `✅ Signed in as ${data.user.email || data.user.id}` : "ℹ️ Not signed in"
          );
        }
      } catch (e) {
        setAuthStatus("❌ Auth exception");
        setDetails((d) => d + `\nAuth exception: ${e.message}`);
      }

      // 2) DB PING — can we reach a table?
      try {
        const { error } = await supabase
          .from("clubs_public")
          .select("*", { count: "exact", head: true })
          .limit(1);

        if (error) {
          setDbStatus("❌ DB error");
          setDetails((d) => d + `\nDB error (clubs_public): ${error.message}`);
        } else {
          setDbStatus("✅ DB reachable (clubs_public)");
        }
      } catch (e) {
        setDbStatus("❌ DB exception");
        setDetails((d) => d + `\nDB exception: ${e.message}`);
      }
    })();
  }, []);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-4">Supabase Ping</h1>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg bg-zinc-800 p-3">
            <div className="text-zinc-400">Auth status</div>
            <div className="mt-1">{authStatus}</div>
          </div>

          <div className="rounded-lg bg-zinc-800 p-3">
            <div className="text-zinc-400">Database status</div>
            <div className="mt-1">{dbStatus}</div>
          </div>

          {details && (
            <pre className="rounded-lg bg-black/60 p-3 overflow-x-auto text-xs text-zinc-300">
              {details}
            </pre>
          )}

          <p className="text-xs text-zinc-400 mt-3">
            Tip: If you see a “permission denied” or RLS error for <code>clubs_public</code>, either sign
            in and make sure your policies allow <em>select</em> for authenticated users, or try a
            different table that allows reads.
          </p>
        </div>
      </div>
    </div>
  );
}
