// src/App.jsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  useLocation,
  useNavigate,
  useParams,
  Navigate,
} from "react-router-dom";
import { useState, useMemo, useEffect, Suspense, lazy } from "react";
import debounce from "lodash.debounce";
import { Toaster } from "react-hot-toast";

import "./styles/glows.css";
import "./pages/Events.css";
import NavActions from "./components/NavActions";

import { UserProvider, useUser } from "./context/UserContext";
import supabase from "./supabaseClient";

// Lazy pages
const Events = lazy(() => import("./pages/Events"));
const Clubs2 = lazy(() => import("./pages/Clubs2"));
const MovieDetails = lazy(() => import("./pages/MovieDetails"));
const SearchResults = lazy(() => import("./pages/SearchResults"));
const Movies = lazy(() => import("./pages/Movies"));
const ClubProfile = lazy(() => import("./pages/ClubProfile"));
const MembersPage = lazy(() => import("./pages/MembersPage"));
const UserProfile = lazy(() => import("./pages/UserProfile.jsx"));
const CreateClubWizard = lazy(() => import("./pages/CreateClubWizard"));
const ClubEventDetails = lazy(() => import("./pages/ClubEventDetails"));
const ClubPreview = lazy(() => import("./pages/ClubPreview"));
const EventAttendance = lazy(() => import("./pages/EventAttendance"));
const SupabasePing = lazy(() => import("./dev/SupabasePing"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const HomeSignedIn = lazy(() => import("./pages/HomeSignedIn"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const ClubChat = lazy(() => import("./pages/ClubChat"));
const LeaderboardAndPlayoffs = lazy(() => import("./pages/LeaderboardAndPlayoffs.jsx"));
const ClubRequests = lazy(() => import("./pages/ClubRequests.jsx"));
const PremiumPage = lazy(() => import("./pages/PremiumPage"));         // marketing (non-premium)
const PremiumSuccess = lazy(() => import("./pages/PremiumSuccess.jsx")); // post-checkout finalize

// Premium/president-only pages
const ClubSettings = lazy(() => import("./pages/ClubSettings.jsx"));
const ManageInvites = lazy(() => import("./pages/ManageInvites"));
const ClubAnalytics = lazy(() => import("./pages/ClubAnalytics.jsx"));

// Quiet premium management page
const SettingsPremium = lazy(() => import("./pages/SettingsPremium.jsx"));

// UI
const NotificationsBell = lazy(() => import("./components/NotificationsBell"));
const Splash = lazy(() => import("./components/Splash"));

/* ---------- Helpers ---------- */
function ClubSingularRedirect() {
  const { id } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    if (id) navigate(`/clubs/${id}`, { replace: true });
  }, [id, navigate]);
  return null;
}

// Wait for auth to hydrate before routing the user to their club
function MyClubSmartRedirect() {
  const { user, loading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (loading) return;

      // Not signed in → go to /clubs
      if (!user?.id) {
        navigate("/clubs", { replace: true });
        return;
      }

      // 1) localStorage fast path
      const lsSlug = localStorage.getItem("activeClubSlug");
      const lsId = localStorage.getItem("activeClubId");
      if (lsSlug) { navigate(`/clubs/${lsSlug}`, { replace: true }); return; }
      if (lsId)   { navigate(`/clubs/${lsId}`,   { replace: true }); return; }

      // 2) Supabase fallback (two-step, schema-safe: no joins, no unknown columns)
      try {
        const { data: mem, error: memErr } = await supabase
          .from("club_members")
          .select("club_id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (memErr) throw memErr;

        const clubId = mem?.club_id || null;
        if (!clubId) {
          navigate("/clubs", { replace: true });
          return;
        }

        // fetch slug for nicer URL if it exists
        const { data: club, error: clubErr } = await supabase
          .from("clubs")
          .select("id, slug")
          .eq("id", clubId)
          .maybeSingle();

        if (clubErr) throw clubErr;

        const slug = club?.slug || null;

        if (slug) {
          localStorage.setItem("activeClubSlug", slug);
          localStorage.setItem("activeClubId", club.id);
          if (mounted) navigate(`/clubs/${slug}`, { replace: true });
          return;
        }

        // fallback to id
        localStorage.setItem("activeClubId", clubId);
        if (mounted) navigate(`/clubs/${clubId}`, { replace: true });
      } catch {
        navigate("/clubs", { replace: true });
      }
    })();

    return () => { mounted = false; };
  }, [user?.id, loading, navigate]);

  return <Splash message="Finding your club…" />;
}

/* ==================== GUARD: RequirePresidentPremium ==================== */
function RequirePresidentPremium({ children }) {
  const { user, profile } = useUser();
  const { clubParam } = useParams();
  const [ok, setOk] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!user?.id) { setOk(false); return; }

        const isPremium =
          profile?.plan === "directors_cut" || profile?.is_premium === true;
        if (!isPremium) { setOk(false); return; }

        // Resolve club by slug or id
        let clubId = null;
        if (/^[0-9a-f-]{16,}$/.test(clubParam)) {
          clubId = clubParam;
        } else {
          const { data: bySlug } = await supabase
            .from("clubs")
            .select("id")
            .eq("slug", clubParam)
            .maybeSingle();
          clubId = bySlug?.id || null;
        }
        if (!clubId) { setOk(false); return; }

        // Must be president of this club
        const { data: mem } = await supabase
          .from("club_members")
          .select("role")
          .eq("club_id", clubId)
          .eq("user_id", user.id)
          .maybeSingle();

        const isPresident = mem?.role === "president";
        if (!isPresident) { setOk(false); return; }

        if (mounted) setOk(true);
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => { mounted = false; };
  }, [user?.id, profile?.plan, profile?.is_premium, clubParam]);

  if (checking) return <Splash message="Checking permissions…" />;
  if (!ok) return <Navigate to="/premium" replace />;

  return children;
}

/* ==================== APP WRAPPER ==================== */
export default function AppWrapper() {
  return (
    <UserProvider>
      <Router>
        <Routes>
          <Route
            path="/*"
            element={
              <Suspense fallback={<Splash />}>
                <MainShell />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}

/* ==================== MAIN SHELL ==================== */
function MainShell() {
  const { user, isPremium } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  const [rawQuery, setRawQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const debouncedSearch = useMemo(
    () => debounce((value) => setSearchQuery(value), 500),
    []
  );

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setRawQuery(value);
    debouncedSearch(value);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && rawQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(rawQuery.trim())}`);
    }
  };

  useEffect(() => {
    if (location.pathname === "/movies") {
      setRawQuery("");
      setSearchQuery("");
    }
  }, [location.pathname]);

  const linkClass = (isActive) =>
    [
      "relative px-2 py-1 text-zinc-300 hover:text-white transition-colors",
      "after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-0 after:bg-yellow-400",
      "after:transition-[width] after:duration-300 hover:after:w-full",
      isActive ? "text-white after:w-full" : "",
    ].join(" ");

  // Always send signed-in users to /myclub; let the redirect decide the exact club
  const myClubTo = user ? "/myclub" : "/clubs";

  const navItems = [
    { to: "/", label: "Home", end: true },
    { to: "/clubs", label: "Clubs" },
    { to: myClubTo, label: "My Club" },
    { to: "/movies", label: "Movies" },
  ];

  const uniqueNav = [];
  const seen = new Set();
  for (const item of navItems) {
    if (seen.has(item.to)) continue;
    seen.add(item.to);
    uniqueNav.push(item);
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white font-sans">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="grid grid-cols-[auto_1fr_auto] items-center h-16 gap-4">
            <div className="justify-self-start">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  [
                    "text-xl md:text-2xl font-bold tracking-wide",
                    "relative px-2 py-1 text-zinc-300 hover:text-white transition-colors",
                    "after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-0 after:bg-yellow-400",
                    "after:transition-[width] after:duration-300 hover:after:w-full",
                    isActive ? "text-white after:w-full" : "",
                  ].join(" ")
                }
                aria-label="Go to SuperFilm Home"
              >
                SuperFilm
              </NavLink>
            </div>

            <div />

            <div className="justify-self-end flex items-center gap-4">
              <nav className="hidden sm:block" aria-label="Primary">
                <ul className="flex items-center gap-5 md:gap-6">
                  {uniqueNav.map(({ to, label, end }, idx) => (
                    <li key={`${label}-${to}-${idx}`}>
                      <NavLink
                        to={to}
                        end={!!end}
                        className={({ isActive }) => linkClass(isActive)}
                      >
                        {label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* Premium CTA / Management */}
              {!isPremium ? (
                <NavLink
                  to="/premium"
                  aria-label="Go to SuperFilm Director's Cut (Premium)"
                  className={[
                    "relative inline-flex items-center justify-center rounded-2xl px-4 py-2 font-semibold",
                    "text-black",
                    "bg-gradient-to-br from-yellow-300 to-amber-500",
                    "shadow-[0_0_30px_rgba(255,200,0,0.35)] hover:shadow-[0_0_42px_rgba(255,200,0,0.55)]",
                    "transition-all duration-300 hover:scale-[1.02]",
                    "ring-1 ring-yellow-300/60 hover:ring-yellow-200"
                  ].join(" ")}
                >
                  Director&apos;s Cut
                </NavLink>
              ) : (
                <NavLink
                  to="/settings/premium"
                  aria-label="Manage SuperFilm Premium subscription"
                  className={[
                    "inline-flex items-center gap-2 rounded-xl px-3 py-2",
                    "bg-zinc-800/80 hover:bg-zinc-700/80",
                    "text-zinc-200 hover:text-white",
                    "ring-1 ring-white/10 transition-all"
                  ].join(" ")}
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-yellow-400" />
                  Manage Premium
                </NavLink>
              )}

              <input
                type="text"
                value={rawQuery}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                placeholder="Search films..."
                className="bg-zinc-800 text-white placeholder-zinc-400 rounded-full px-4 py-2 w-44 md:w-56 focus:w-64 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all duration-300"
                aria-label="Search films"
              />

              {/* Only show bell when signed in */}
              {user && (
                <Suspense fallback={null}>
                  <NotificationsBell />
                </Suspense>
              )}

              {/* Signed-in: AccountMenu; Signed-out: Sign in / Join SuperFilm */}
              <NavActions />
            </div>
          </div>
        </div>
      </header>

      {/* ===== Main ===== */}
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <Suspense fallback={<Splash />}>
          <Routes>
            <Route path="/" element={user ? <HomeSignedIn /> : <LandingPage />} />

            {/* Clubs */}
            <Route path="/clubs" element={<Clubs2 />} />
            <Route path="/clubs/:clubParam" element={<ClubProfile />} />

            {/* Premium president-only */}
            <Route
              path="/clubs/:clubParam/settings"
              element={
                <RequirePresidentPremium>
                  <ClubSettings />
                </RequirePresidentPremium>
              }
            />
            <Route
              path="/clubs/:clubParam/invites"
              element={
                <RequirePresidentPremium>
                  <ManageInvites />
                </RequirePresidentPremium>
              }
            />
            <Route
              path="/club/:slug/analytics"
              element={
                <RequirePresidentPremium>
                  <ClubAnalytics />
                </RequirePresidentPremium>
              }
            />

            <Route path="/events" element={<Events />} />

            {/* Chat */}
            <Route path="/clubs/:clubParam/chat" element={<ClubChat />} />
            <Route path="/club/:clubId/chat" element={<ClubChat />} />

            {/* Legacy redirect */}
            <Route path="/club/:id" element={<ClubSingularRedirect />} />

            {/* Legacy variants */}
            <Route path="/club/:id/members" element={<MembersPage />} />
            <Route path="/club/:id/event/:eventSlug" element={<ClubEventDetails />} />

            {/* Nested event/members (slug or uuid) */}
            <Route path="/clubs/:clubParam/events/next" element={<EventAttendance />} />
            <Route path="/clubs/:clubParam/members" element={<MembersPage />} />

            {/* Old links support */}
            <Route path="/clubs/:id/events/next" element={<EventAttendance />} />

            {/* Other pages */}
            <Route path="/movies" element={<Movies searchQuery={searchQuery} />} />
            <Route path="/profile" element={<UserProfile key={window.location.search} />} />
            <Route path="/movie/:id" element={<MovieDetails />} />
            <Route path="/movies/:id" element={<MovieDetails />} />   {/* alias */}
            <Route path="/clubs/:clubParam/movies/:id" element={<MovieDetails />} />

            <Route path="/search" element={<SearchResults />} />
            <Route path="/create-club" element={<CreateClubWizard />} />
            <Route path="/club-preview" element={<ClubPreview />} />
            <Route path="/dev/ping" element={<SupabasePing />} />
            <Route path="/u/:slug" element={<UserProfile />} />
            <Route path="/profile/:id" element={<UserProfile />} />
            <Route path="/clubs/:clubParam/requests" element={<ClubRequests />} />
            <Route path="/auth" element={<AuthPage />} />

            {/* Premium routing */}
            <Route
              path="/premium"
              element={isPremium ? <Navigate to="/settings/premium" replace /> : <PremiumPage />}
            />
            <Route path="/settings/premium" element={<SettingsPremium />} />
            <Route path="/premium/success" element={<PremiumSuccess />} />

            {/* My Club */}
            <Route path="/myclub" element={<MyClubSmartRedirect />} />
            <Route path="/leaderboard" element={<LeaderboardAndPlayoffs />} />

            {/* Notifications page */}
            <Route path="/notifications" element={<NotificationsPage />} />

            {/* Optional alias */}
            <Route path="/home" element={<HomeSignedIn />} />
          </Routes>
        </Suspense>
      </main>

      <Toaster position="top-center" />
      <footer className="text-center text-sm text-zinc-500 p-4 border-t border-zinc-800 mt-8">
        © {new Date().getFullYear()} SuperFilm. All rights reserved.
      </footer>
    </div>
  );
}
