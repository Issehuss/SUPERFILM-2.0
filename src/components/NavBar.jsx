// src/components/NavBar.jsx
import { Link } from "react-router-dom";
import { useUser } from "../context/UserContext";

export default function NavBar() {
  const { user, avatar, signOut } = useUser();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e) {
      alert(e.message || "Sign out failed");
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-black/70 backdrop-blur border-b border-zinc-800">
      <nav className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between text-white">
        <Link to="/" className="font-semibold tracking-wide">SuperFilm</Link>

        <div className="flex items-center gap-3">
          {user?.id ? (
            <>
              <Link to="/profile" className="flex items-center gap-2">
                <img
                  src={avatar}
                  alt="Your avatar"
                  className="h-8 w-8 rounded-full border border-zinc-700"
                />
                <span className="hidden sm:inline text-sm text-zinc-300">
                  {user.email || "Account"}
                </span>
              </Link>
              <button
                onClick={handleSignOut}
                className="text-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/auth"
                className="text-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800"
              >
                Sign in
              </Link>
              <Link
                to="/auth"
                className="text-sm px-3 py-1.5 rounded-lg bg-yellow-500 text-black hover:bg-yellow-400"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
