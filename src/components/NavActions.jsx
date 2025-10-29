// src/components/NavActions.jsx
import { useMemo } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useUser } from "../context/UserContext";
import AccountMenu from "./AccountMenu";

export default function NavActions({ className = "" }) {
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthPage = useMemo(() => location.pathname.startsWith("/auth"), [location.pathname]);

  if (user) {
    // Already signed in → show your existing account menu
    return <div className={`flex items-center gap-2 ${className}`}><AccountMenu /></div>;
  }

  // Signed out → show SuperFilm-styled buttons
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!isAuthPage && (
        <>
          <Link
            to="/auth?mode=signin"
            className="px-3 h-9 inline-flex items-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-sm text-white transition"
          >
            Sign in
          </Link>
          <button
            onClick={() => navigate("/auth?mode=signup")}
            className="px-4 h-9 inline-flex items-center rounded-full bg-yellow-400/90 hover:bg-yellow-400 text-black text-sm font-semibold shadow-[0_0_0_1px_rgba(0,0,0,0.2)]"
          >
            Join SuperFilm
          </button>
        </>
      )}
    </div>
  );
}
