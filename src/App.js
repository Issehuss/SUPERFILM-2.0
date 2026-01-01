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
import { trackPageView } from "./lib/analytics";
import BetaBanner from "./components/BetaBanner";

import "./styles/glows.css";
import NavActions from "./components/NavActions";

import { UserProvider, useUser } from "./context/UserContext";
import supabase from "./supabaseClient";
import ErrorBoundary from "./components/ErrorBoundary";







// Lazy pages
const Events = lazy(() => import("./pages/Events"));
const EventNew = lazy(() => import("./pages/EventNew.jsx"));
const EventDetails = lazy(() => import("./pages/EventDetails.jsx"));

const MovieDetails = lazy(() => import("./pages/MovieDetails"));
const SearchResults = lazy(() => import("./pages/SearchResults"));
const Movies = lazy(() => import("./pages/Movies"));
const ClubProfile = lazy(() => import("./pages/ClubProfile"));
const MembersPage = lazy(() => import("./pages/MembersPage"));
const UserProfile = lazy(() => import("./pages/UserProfile.jsx"));

// ⬇️ Removed unused CreateClubWizard import
const ClubEventDetails = lazy(() => import("./pages/ClubEventDetails"));
const ClubPreview = lazy(() => import("./pages/ClubPreview"));
const EventAttendance = lazy(() => import("./pages/EventAttendance"));
const SupabasePing = lazy(() => import("./dev/SupabasePing"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const HomeSignedIn = lazy(() => import("./pages/HomeSignedIn"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const ClubChat = lazy(() => import("./pages/ClubChat"));
const LeaderboardAndPlayoffs = lazy(() =>
  import("./pages/LeaderboardAndPlayoffs.jsx")
);
const ClubRequests = lazy(() => import("./pages/ClubRequests.jsx"));
const PremiumPage = lazy(() => import("./pages/PremiumPage"));
const PremiumSuccess = lazy(() => import("./pages/PremiumSuccess.jsx"));
const DirectorsCutSuccess = lazy(() => import("./pages/DirectorsCutSuccess.jsx"));
const UserFilmTakes = lazy(() => import("./pages/UserFilmTakes"));
const ClubTakesArchive = lazy(() => import("./pages/ClubTakesArchive.jsx"));
const Clubs = lazy(() => import("./pages/Clubs.jsx"));
const LeaveClub = lazy(() => import("./pages/LeaveClub.jsx"));
const OnboardingTutorial = lazy(() =>
  import("./components/onboarding/OnboardingTutorial.jsx")
);
const AboutPage = lazy(() => import("./pages/AboutPage.jsx"));
const CookiesPage = lazy(() => import("./pages/CookiesPage.jsx"));
const CommunityGuidelines = lazy(() =>
  import("./pages/CommunityGuidelines.jsx")
);
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const UserSearchPage = lazy(() => import("./pages/UserSearchPage.jsx"));
const TermsPage = lazy(() => import("./pages/Terms.jsx"));

// Premium/president-only pages
const ClubSettings = lazy(() => import("./pages/ClubSettings.jsx"));
const ManageInvites = lazy(() => import("./pages/ManageInvites"));


// Quiet premium management page
const SettingsPremium = lazy(() => import("./pages/SettingsPremium.jsx"));

// ⬇️ New wrappers (make sure these files exist)
const CreateClubPage = lazy(() => import("./pages/CreateClubPage.jsx"));
const MyClub = lazy(() => import("./pages/MyClub.jsx"));

// UI
const NotificationsBell = lazy(() => import("./components/NotificationsBell"));
const Splash = lazy(() => import("./components/Splash"));
// ⬇️ Club Switcher dropdown (premium feature)
const ClubSwitcher = lazy(() => import("./components/ClubSwitcher.jsx"));
const SuperFilmFooter = lazy(() =>
  import("./pages/AboutPage.jsx").then((m) => ({ default: m.SuperFilmFooter }))
);



/* ---------- Helpers ---------- */
function ClubSingularRedirect() {
  const { id } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    if (id) navigate(`/clubs/${id}`, { replace: true });
  }, [id, navigate]);
  return null;
}

function PageViewTracker() {
  const location = useLocation();
  useEffect(() => {
    const path = `${location.pathname}${location.search || ""}`;
    trackPageView(path);
  }, [location.pathname, location.search]);
  return null;
}

/* ==================== GUARD: RequirePresidentPremium ==================== */
function RequirePresidentPremium({ children }) {
  const { user, profile, loading, sessionLoaded } = useUser();
  const { clubParam } = useParams();
  const [ok, setOk] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading || !sessionLoaded) return; // wait for user/profile hydration
    let mounted = true;
    (async () => {
      try {
        if (!user?.id) {
          setOk(false);
          return;
        }

        const isPremium =
          profile?.plan === "directors_cut" || profile?.is_premium === true;
        if (!isPremium) {
          setOk(false);
          return;
        }

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
        if (!clubId) {
          setOk(false);
          return;
        }

        const { data: mem } = await supabase
          .from("club_members")
          .select("role")
          .eq("club_id", clubId)
          .eq("user_id", user.id)
          .maybeSingle();

        const isPresident = mem?.role === "president";
        if (!isPresident) {
          setOk(false);
          return;
        }

        if (mounted) setOk(true);
      } finally {
        if (mounted) setChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.id, profile?.plan, profile?.is_premium, clubParam]);

  if (loading || checking) return <Splash message="Checking permissions…" />;
  if (!ok) return <Navigate to="/premium" replace />;

  return children;
}

/* ==================== APP WRAPPER ==================== */
export default function AppWrapper() {
  // STEP 3: Force Supabase session hydration on boot
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      console.log("[APP SESSION HYDRATE]", data.session);
    });
  }, []);

  return (
    <UserProvider>
      <Router>
      <PageViewTracker />
      <BetaBanner />
      <Routes>
  {/* Onboarding route — renders BEFORE MainShell */}
  <Route
    path="/onboarding"
    element={
      <Suspense fallback={<Splash />}>
        <OnboardingTutorial />
      </Suspense>
    }
  />

  {/* Everything else */}
  <Route
    path="/*"
    element={
      <ErrorBoundary fallback={<Splash message="Something went wrong loading the app." />}>
        <Suspense fallback={<Splash />}>
          <MainShell />
        </Suspense>
      </ErrorBoundary>
    }
  />

  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>

      </Router>
    </UserProvider>
  );
}

/* ==================== DYNAMIC NAV LINK ==================== */
function NavClubSwitch() {
  const { user, loading } = useUser();
  const [checking, setChecking] = useState(true);
  const [target, setTarget] = useState({
    to: "/create-club",
    label: "Create a Club",
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (loading) return;
      if (!user?.id) {
        if (!cancelled) {
          setTarget({ to: "/auth", label: "Sign in" });
          setChecking(false);
        }
        return;
      }

      setChecking(true);
      try {
        const { data, error } = await supabase
          .from("club_members")
          .select("club_id, clubs:club_id(id, slug)")
          .eq("user_id", user.id)
          .limit(1);

        if (cancelled) return;

        if (error) throw error;

        const row = data?.[0];
        if (row?.clubs?.id) {
          const slug = row.clubs.slug || row.clubs.id;
          localStorage.setItem("activeClubId", String(row.clubs.id));
          localStorage.setItem("activeClubSlug", String(slug));
          localStorage.setItem("myClubId", String(slug));
          setTarget({ to: "/myclub", label: "My Club" });
        } else {
          localStorage.removeItem("activeClubId");
          localStorage.removeItem("activeClubSlug");
          localStorage.removeItem("myClubId");
          setTarget({ to: "/create-club", label: "Create a Club" });
        }
      } catch {
        setTarget({ to: "/create-club", label: "Create a Club" });
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user?.id, loading]);

  const linkClass = (isActive) =>
    [
      "relative px-2 py-1 text-zinc-300 hover:text-white transition-colors",
      "after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-0 after:bg-yellow-400",
      "after:transition-[width] after:duration-300 hover:after:w-full",
      isActive ? "text-white after:w-full" : "",
    ].join(" ");

  if (checking) {
    return (
      <span className="px-2 py-1 text-zinc-500 cursor-default select-none">
        My Club
      </span>
    );
  }

  return (
    <NavLink to={target.to} className={({ isActive }) => linkClass(isActive)}>
      {target.label}
    </NavLink>
  );
}

/* ==================== MAIN SHELL ==================== */
function MainShell() {
  const { user, isPremium, profile, loading: userLoading, isReady } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  // Clears the onboarding "stuck" state if user already completed it (e.g., DB flag set) but local flag missing
  useEffect(() => {
    if (profile?.has_seen_onboarding === true) {
      try {
        localStorage.setItem("sf:onboarding_seen", "1");
      } catch {}
    }
  }, [profile?.has_seen_onboarding]);

  // ⬇️ Onboarding redirect: only show onboarding once
useEffect(() => {
  if (userLoading || !isReady) return;
  // Treat missing flag as not seen yet
  const seen =
    profile?.has_seen_onboarding === true ||
    (typeof window !== "undefined" &&
      localStorage.getItem("sf:onboarding_seen") === "1");
  if (user && !seen) {
    navigate("/onboarding", { replace: true });
  }
}, [user, profile, navigate, userLoading, isReady]);


  const [rawQuery, setRawQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState("films"); // "films" | "users"

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
    if (e.key !== "Enter") return;
  
    const trimmed = rawQuery.trim();
    if (!trimmed) return;
  
    if (searchMode === "users") {
      navigate(`/search/users?q=${encodeURIComponent(trimmed.replace(/^@/, ""))}`);
      return;
    }

    // If query starts with '@' → USER SEARCH override
    if (trimmed.startsWith("@")) {
      const userQuery = trimmed.slice(1).trim(); // remove @
      if (!userQuery) return;
      navigate(`/search/users?q=${encodeURIComponent(userQuery)}`);
      return;
    }
  
    // Otherwise → MOVIE SEARCH (existing behaviour)
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
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

  if (!isReady) {
    return <Splash message="Loading your session…" />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white font-sans">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur border-b border-white/10">
  <div className="w-full flex items-center h-16">
    
    {/* LEFT: SuperFilm logo */}
    <div className="flex-shrink-0 pl-4 md:pl-6">
      <NavLink
        to="/"
        end
        aria-label="Go to SuperFilm Home"
        className={({ isActive }) =>
          [
            "group relative flex items-center gap-2",
            "text-2xl md:text-3xl font-bold tracking-wide",
            "text-zinc-200 hover:text-white transition-colors",
            "after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-0 after:bg-yellow-400",
            "after:transition-[width] after:duration-300 group-hover:after:w-full",
            isActive ? "text-white after:w-full" : "",
          ].join(" ")
        }
      >
        <div className="flex items-center gap-2">
          <span>SuperFilm</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-yellow-300/90 border border-yellow-300/30 rounded-full px-2 py-[3px] bg-yellow-300/10">
            Beta
          </span>
        </div>
        <img
          src="/superfilm-logo.png"
          alt=""
          aria-hidden="true"
          className="h-6 w-6 md:h-7 md:w-7 object-contain"
          draggable="false"
        />
      </NavLink>
    </div>

                {/* Center: nav + search aligned to content width */}
                <div className="flex-1 flex justify-center">
              <nav
                className="hidden sm:block w-full"
                aria-label="Primary navigation"
              >
                <ul className="mx-auto max-w-6xl w-full flex items-center justify-between px-6 gap-4">
                  {/* Home */}
                  <li>
                    <NavLink
                      to="/"
                      end
                      className={({ isActive }) => linkClass(isActive)}
                    >
                      Home
                    </NavLink>
                  </li>

                  {/* Clubs */}
                  <li>
                    <NavLink
                      to="/clubs"
                      className={({ isActive }) => linkClass(isActive)}
                    >
                      Discover
                    </NavLink>
                  </li>

                  {/* My Clubs dropdown (ClubSwitcher) */}
                  <li>
                    <Suspense fallback={null}>
                      <ClubSwitcher />
                    </Suspense>
                  </li>

                  {/* Movies */}
                  <li>
                    <NavLink
                      to="/movies"
                      className={({ isActive }) => linkClass(isActive)}
                    >
                      Movies
                    </NavLink>
                  </li>

                  {/* Search bar – part of the evenly spaced group */}
                  <li className="hidden md:flex items-center gap-2">
                    <div className="flex items-center rounded-full bg-zinc-800 ring-1 ring-white/10 px-2">
                      <input
                        type="text"
                        value={rawQuery}
                        onChange={handleSearchChange}
                        onKeyDown={handleKeyDown}
                        placeholder={
                          searchMode === "users" ? "Search @usernames" : "Search films/@cinephiles"
                        }
                        className="
                          bg-transparent text-white placeholder-zinc-400 rounded-full 
                          px-3 py-2 w-48 lg:w-60
                          outline-none
                          transition-all duration-300
                          focus:ring-0
                        "
                        aria-label="Search"
                      />
                      <div className="flex rounded-full bg-zinc-900/80 ring-1 ring-white/10">
                        <button
                          type="button"
                          onClick={() => setSearchMode("films")}
                          className={`text-[11px] px-3 py-1 rounded-full transition ${
                            searchMode === "films"
                              ? "bg-yellow-400 text-black shadow-[0_0_12px_rgba(255,215,0,0.35)]"
                              : "text-zinc-300 hover:text-white"
                          }`}
                          aria-pressed={searchMode === "films"}
                        >
                          Films
                        </button>
                        <button
                          type="button"
                          onClick={() => setSearchMode("users")}
                          className={`text-[11px] px-3 py-1 rounded-full transition ${
                            searchMode === "users"
                              ? "bg-yellow-400 text-black shadow-[0_0_12px_rgba(255,215,0,0.35)]"
                              : "text-zinc-300 hover:text-white"
                          }`}
                          aria-pressed={searchMode === "users"}
                        >
                          Users
                        </button>
                      </div>
                    </div>
                  </li>
                </ul>
              </nav>
            </div>

    {/* RIGHT: bell + account menu */}
    <div className="flex items-center gap-3 pr-4 md:pr-6">
      {user && (
        <Suspense fallback={null}>
          <NotificationsBell />
        </Suspense>
      )}

      <NavActions />
    </div>

  </div>
</header>



      {/* ===== Main ===== */}

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <Suspense fallback={<Splash />}>
          <Routes>
            <Route
              path="/"
              element={user ? <HomeSignedIn /> : <LandingPage />}
            />

            {/* Clubs */}
            <Route path="/clubs/:clubParam" element={<ClubProfile />} />
            <Route path="/clubs/:clubParam/takes/archive" element={<ClubTakesArchive />} />

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
           

            <Route path="/events" element={<Events />} />
            <Route path="/events/new" element={<EventNew />} />
            <Route path="/events/:slug" element={<EventDetails />} />

            <Route path="/u/:slug/takes" element={<UserFilmTakes />} />

            {/* Chat */}
            <Route path="/clubs/:clubParam/chat" element={<ClubChat />} />
            <Route path="/club/:clubId/chat" element={<ClubChat />} />

            {/* Legacy redirect */}
            <Route path="/club/:id" element={<ClubSingularRedirect />} />

            {/* Legacy variants */}
            <Route path="/club/:id/members" element={<MembersPage />} />
            <Route
              path="/club/:id/event/:eventSlug"
              element={<ClubEventDetails />}
            />

            {/* Nested event/members (slug or uuid) */}
            <Route
              path="/clubs/:clubParam/events/next"
              element={<EventAttendance />}
            />

<Route
  path="/clubs/:clubParam/leave"
  element={<LeaveClub />}
/>

<Route path="/clubs/:clubParam/leave" element={<LeaveClub />} />
            <Route
              path="/clubs/:clubParam/members"
              element={<MembersPage />}
            />

            {/* Old links support */}
            <Route
              path="/clubs/:id/events/next"
              element={<EventAttendance />}
            />

            {/* Other pages */}
            <Route
              path="/movies"
              element={<Movies searchQuery={searchQuery} />}
            />
            <Route
              path="/profile"
              element={<UserProfile key={window.location.search} />}
            />
            <Route path="/movie/:id" element={<MovieDetails />} />
            <Route path="/movies/:id" element={<MovieDetails />} />{" "}
            {/* alias */}
            <Route
              path="/clubs/:clubParam/movies/:id"
              element={<MovieDetails />}
            />

            <Route path="/search" element={<SearchResults />} />

            {/* NEW wrappers */}
            <Route path="/create-club" element={<CreateClubPage />} />
            <Route path="/myclub" element={<MyClub />} />

            <Route path="/club-preview" element={<ClubPreview />} />
            <Route path="/dev/ping" element={<SupabasePing />} />
            <Route path="/u/:slug" element={<UserProfile />} />
            <Route path="/profile/:id" element={<UserProfile />} />
            <Route
              path="/clubs/:clubParam/requests"
              element={<ClubRequests />}
            />
            <Route path="/auth" element={<AuthPage />} />

            {/* Premium routing */}
            <Route
              path="/premium"
              element={
                isPremium ? (
                  <Navigate to="/settings/premium" replace />
                ) : (
                  <PremiumPage />
                )
              }
            />
            <Route
              path="/directors-cut"
              element={
                isPremium ? (
                  <Navigate to="/settings/premium" replace />
                ) : (
                  <PremiumPage />
                )
              }
            />
            <Route path="/settings/premium" element={<SettingsPremium />} />
            <Route path="/premium/success" element={<PremiumSuccess />} />
            <Route path="/directors-cut/success" element={<DirectorsCutSuccess />} />

            <Route
              path="/leaderboard"
              element={<LeaderboardAndPlayoffs />}
            />
            <Route
              path="/notifications"
              element={<NotificationsPage />}
            />
            <Route path="/home" element={<HomeSignedIn />} />
            <Route path="/me/club" element={<MyClub />} />
            <Route path="/clubs" element={<Clubs />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/cookies" element={<CookiesPage />} />
            <Route path="/guidelines" element={<CommunityGuidelines />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/auth/forgot" element={<ForgotPassword />} />
<Route path="/auth/reset" element={<ResetPassword />} />
<Route path="/search/users" element={<UserSearchPage />} />







            
          </Routes>
        </Suspense>
      </main>

      <Toaster position="top-center" />
      <Suspense fallback={null}>
        <SuperFilmFooter />
      </Suspense>
    </div>
  );
}
