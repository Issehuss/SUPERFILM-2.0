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
import Clubs from "./pages/Clubs.jsx"; 
import UserFilmTakes from "./pages/UserFilmTakes";


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
const LeaderboardAndPlayoffs = lazy(() => import("./pages/LeaderboardAndPlayoffs.jsx"));
const ClubRequests = lazy(() => import("./pages/ClubRequests.jsx"));
const PremiumPage = lazy(() => import("./pages/PremiumPage"));
const PremiumSuccess = lazy(() => import("./pages/PremiumSuccess.jsx"));

// Premium/president-only pages
const ClubSettings = lazy(() => import("./pages/ClubSettings.jsx"));
const ManageInvites = lazy(() => import("./pages/ManageInvites"));
const ClubAnalytics = lazy(() => import("./pages/ClubAnalytics.jsx"));

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


/* ---------- Helpers ---------- */
function ClubSingularRedirect() {
  const { id } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    if (id) navigate(`/clubs/${id}`, { replace: true });
  }, [id, navigate]);
  return null;
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

   // STEP 3: Force Supabase session hydration on boot
   useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      console.log("[APP SESSION HYDRATE]", data.session);
    });
  }, []);

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

/* ==================== DYNAMIC NAV LINK ==================== */
function NavClubSwitch() {
  const { user, loading } = useUser();
  const [checking, setChecking] = useState(true);
  const [target, setTarget] = useState({ to: "/create-club", label: "Create a Club" });

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
    return () => { cancelled = true; };
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
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white font-sans">
        {/* ===== Header ===== */}
        {/* ===== Header ===== */}
        <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur border-b border-white/10">
  {/* Edge-to-edge shell so the logo can sit on the true left edge */}
  <div className="w-full">
    <div className="flex items-center h-16">
   {/* Left: Title with logo to the right, subtle inset + underline */}
<div className="flex-shrink-0">
  <NavLink
    to="/"
    end
    aria-label="Go to SuperFilm Home"
    className={({ isActive }) =>
      [
        // layout + spacing
        "group relative flex items-center gap-2",
        "ml-4 md:ml-6",

        // typography / color
        "text-2xl md:text-3xl font-bold tracking-wide",
        "text-zinc-200 hover:text-white transition-colors",

        // yellow underline (hover + active)
        "after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-0 after:bg-yellow-400",
        "after:transition-[width] after:duration-300 group-hover:after:w-full",
        isActive ? "text-white after:w-full" : "",
      ].join(" ")
    }
  >
    <span>SuperFilm</span>
    <img
      src="/superfilm-logo.png"
      alt=""           // decorative, title already conveys text
      aria-hidden="true"
      className="h-6 w-6 md:h-7 md:w-7 object-contain"
      draggable="false"
    />
  </NavLink>
</div>


      {/* Right: everything else lives inside a centered max-width container */}
      <div className="flex-1">
  <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-center justify-end gap-4">
            {/* Primary nav */}
            <nav className="hidden sm:block" aria-label="Primary">
              <ul className="flex items-center gap-5 md:gap-6">
                <li>
                  <NavLink to="/" end className={({ isActive }) => linkClass(isActive)}>
                    Home
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/clubs" className={({ isActive }) => linkClass(isActive)}>
                    Clubs
                  </NavLink>
                </li>
                <li>
                  <NavClubSwitch />
                </li>
                <li>
                  <NavLink to="/movies" className={({ isActive }) => linkClass(isActive)}>
                    Movies
                  </NavLink>
                </li>
              </ul>
            </nav>

            {/* Club Switcher */}
            <Suspense fallback={null}>
              <ClubSwitcher />
            </Suspense>

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

            {/* Search */}
            <input
              type="text"
              value={rawQuery}
              onChange={handleSearchChange}
              onKeyDown={handleKeyDown}
              placeholder="Search films..."
              className="bg-zinc-800 text-white placeholder-zinc-400 rounded-full px-4 py-2 w-44 md:w-56 focus:w-64 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all duration-300"
              aria-label="Search films"
            />

            {/* Notifications */}
            {user && (
              <Suspense fallback={null}>
                <NotificationsBell />
              </Suspense>
            )}

            {/* Account menu / actions */}
            <NavActions />
          </div>
        </div>
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

            {/* NEW wrappers */}
            <Route path="/create-club" element={<CreateClubPage />} />
            <Route path="/myclub" element={<MyClub />} />

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

            <Route path="/leaderboard" element={<LeaderboardAndPlayoffs />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/home" element={<HomeSignedIn />} />
            <Route path="/me/club" element={<MyClub />} />
            <Route path="/clubs" element={<Clubs />} />

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
