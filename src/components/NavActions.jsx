// src/components/NavActions.jsx
import { useMemo } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useUser } from "../context/UserContext";
import AccountMenu from "./AccountMenu";

export default function NavActions({ className = "" }) {
  const { user, isPremium } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const isAuthPage = useMemo(
    () => location.pathname.startsWith("/auth"),
    [location.pathname]
  );

  if (user) {
    // Already signed in → show your existing account menu
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {!isPremium && (
          <NavLink
            to="/directors-cut"
            className={[
              "no-underline inline-flex items-center justify-center rounded-full",
              "px-4 h-9 text-[10px] font-semibold uppercase tracking-[0.28em]",
              "border border-[#f5c451]/60 bg-[radial-gradient(circle_at_20%_20%,rgba(245,196,81,0.25),rgba(0,0,0,0.65)),linear-gradient(135deg,#0a0a0a,#111015,#0a0a0a)]",
              "text-[#f7dba0] shadow-[0_10px_24px_rgba(0,0,0,0.45),0_0_0_1px_rgba(245,196,81,0.18)] transition hover:brightness-105",
            ].join(" ")}
          >
            Director’s Cut
          </NavLink>
        )}
        <AccountMenu />
      </div>
    );
  }

  // Signed out → show SuperFilm-styled buttons
  return (
    <div className={`flex items-center gap-1.5 sm:gap-2 ${className}`}>
      {!isAuthPage && (
        <>
          <Link
            to="/auth?mode=signin"
            className="no-underline px-2.5 sm:px-3 h-8 sm:h-9 inline-flex items-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-xs sm:text-sm text-white transition"
            style={{ textDecoration: "none" }}
          >
            Sign in
          </Link>
          <button
            onClick={() => navigate("/auth?mode=signup")}
            className="px-3 sm:px-4 h-8 sm:h-9 inline-flex items-center rounded-full bg-yellow-400/90 hover:bg-yellow-400 text-black text-xs sm:text-sm font-semibold shadow-[0_0_0_1px_rgba(0,0,0,0.2)]"
          >
            Join SuperFilm
          </button>
        </>
      )}
    </div>
  );
}
