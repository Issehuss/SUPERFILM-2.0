// src/components/NavBar.jsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useUser } from "../context/UserContext";
import AccountMenu from "./AccountMenu"; // if you prefer the avatar+menu when signed in

export default function NavBar() {
  const { user } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  // Hide auth buttons while already on /auth
  const isAuthPage = useMemo(
    () => location.pathname.startsWith("/auth"),
    [location.pathname]
  );

  return (
    <header className="sticky top-0 z-40 bg-black/70 backdrop-blur border-b border-zinc-900/80">
      <nav className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4 text-white">
        <Link to="/" className="font-semibold tracking-wide text-lg">
          SuperFilm
        </Link>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            // Signed in → show your account menu
            <AccountMenu />
          ) : (
            // Signed out → SuperFilm-styled actions
            !isAuthPage && (
              <>
                <Link
                  to="/auth?mode=signin"
                  className="px-3 h-9 inline-flex items-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-sm transition"
                >
                  Sign in
                </Link>
                <button
                  onClick={() => navigate("/auth?mode=signup")}
                  className="px-4 h-9 inline-flex items-center rounded-full bg-yellow-400/90 hover:bg-yellow-400 text-black text-sm font-semibold shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
                >
                  Join SuperFilm
                </button>
              </>
            )
          )}
        </div>
      </nav>
    </header>
  );
}
