// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState, useMemo, useEffect, Suspense, lazy } from 'react';
import debounce from 'lodash.debounce';
import { Toaster } from 'react-hot-toast';

import { UserProvider, useUser } from './context/UserContext';
import './styles/glows.css';

// ✅ membership hook for /myclub redirect
import useMyClubs from './hooks/useMyClubs';

// Chat page (non-lazy is fine since it's lightweight)
import ClubChat from "./pages/ClubChat";

// ✅ splash fallback (logo + "Please wait…")
import Splash from './components/Splash';



/* ========= lazy-loaded pages ========= */
const MovieDetails     = lazy(() => import('./pages/MovieDetails'));
const SearchResults    = lazy(() => import('./pages/SearchResults'));
const Clubs            = lazy(() => import('./pages/Clubs'));
const Movies           = lazy(() => import('./pages/Movies'));
const ClubProfile      = lazy(() => import('./pages/ClubProfile'));
const MembersPage      = lazy(() => import('./pages/MembersPage'));
const UserProfile      = lazy(() => import('./pages/UserProfile.jsx'));
const CreateClubWizard = lazy(() => import('./pages/CreateClubWizard'));
const ClubEventDetails = lazy(() => import('./pages/ClubEventDetails'));
const ClubPreview      = lazy(() => import('./pages/ClubPreview'));
const EventAttendance  = lazy(() => import('./pages/EventAttendance'));
const SupabasePing     = lazy(() => import('./dev/SupabasePing'));
const AuthPage         = lazy(() => import('./pages/AuthPage'));
const LandingPage      = lazy(() => import('./pages/LandingPage'));
const HomeSignedIn     = lazy(() => import('./pages/HomeSignedIn'));

/* --- Redirect helpers --- */
function ClubSingularRedirect() {
  const { id } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    if (id) navigate(`/clubs/${id}`, { replace: true });
  }, [id, navigate]);
  return null;
}

// ✅ Smart "My Club" redirect
// - not signed in → /clubs (list)
// - signed in + has club(s) → /clubs/:slugOrId (first club)
function MyClubSmartRedirect() {
  const { user } = useUser();
  const { myClubs, loadingMyClubs } = useMyClubs();
  const navigate = useNavigate();

  useEffect(() => {
    if (loadingMyClubs) return;

    if (!user) {
      navigate('/clubs', { replace: true });
      return;
    }

    if (myClubs && myClubs.length > 0) {
      const c = myClubs[0];
      navigate(`/clubs/${c.slug || c.id}`, { replace: true });
    } else {
      navigate('/clubs', { replace: true });
    }
  }, [user, myClubs, loadingMyClubs, navigate]);

  // Show splash while deciding
  return <Splash message="Finding your club…" />;
}

function AppWrapper() {
  return (
    <Router>
      <UserProvider>
        <App />
      </UserProvider>
    </Router>
  );
}

function App() {
  const [rawQuery, setRawQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const location = useLocation();

  // 🔑 auth state
  const { user, avatar, signOut } = useUser();

  const debouncedSearch = useMemo(() => debounce((value) => setSearchQuery(value), 500), []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setRawQuery(value);
    debouncedSearch(value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && rawQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(rawQuery.trim())}`;
    }
  };

  useEffect(() => {
    if (location.pathname === "/movies") {
      setRawQuery('');
      setSearchQuery('');
    }
  }, [location.pathname]);

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowDropdown(false);
    } catch (e) {
      alert(e.message || "Sign out failed");
    }
  };

  // ✅ Build a smart href for the "My Club" tab (instant jump when cached)
  const myClubHref = user
    ? (localStorage.getItem("activeClubSlug")
        ? `/clubs/${localStorage.getItem("activeClubSlug")}`
        : (localStorage.getItem("activeClubId")
            ? `/clubs/${localStorage.getItem("activeClubId")}`
            : "/myclub")) // fall back to server-side redirect
    : "/clubs";

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white font-sans">
      <header className="flex items-center justify-between p-6 bg-zinc-950 shadow-md">
        <div className="flex flex-col items-start">
          <h1 className="text-3xl font-bold tracking-wide">SuperFilm</h1>
          <p className="text-sm text-zinc-400 mt-1">Connect through cinema.</p>
        </div>

        <nav className="flex gap-12 mx-auto text-white">
          {/* Home always points to "/" — the route itself switches by auth */}
          <Link className="hover:text-yellow-400 transition" to="/">Home</Link>
          <Link className="hover:text-yellow-400 transition" to="/clubs">Clubs</Link>
          {/* ✅ smart target here */}
          <Link className="hover:text-yellow-400 transition" to={myClubHref}>My Club</Link>
          <Link className="hover:text-yellow-400 transition" to="/movies">Movies</Link>
        </nav>

        <div className="relative flex gap-4 items-center">
          <input
            type="text"
            value={rawQuery}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            placeholder="Search films..."
            className="bg-zinc-800 text-white placeholder-zinc-400 rounded-full px-4 py-2 w-48 focus:w-64 focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all duration-300"
          />

          {user?.id ? (
            <div className="relative">
              <div
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-10 h-10 rounded-full cursor-pointer overflow-hidden border-2 border-white"
              >
                <img src={avatar} alt="User Avatar" className="w-full h-full object-cover" />
              </div>
              {showDropdown && (
                <div className="absolute right-0 mt-2 w-44 bg-zinc-800 text-white rounded-md shadow-lg z-50">
                  <Link to="/profile" onClick={() => setShowDropdown(false)} className="block px-4 py-2 hover:bg-zinc-700">My Profile</Link>
                  <Link to="/profile?edit=true" onClick={() => setShowDropdown(false)} className="block px-4 py-2 hover:bg-zinc-700">Edit Profile</Link>
                  <button onClick={handleSignOut} className="block w-full text-left px-4 py-2 hover:bg-zinc-700">Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <Link to="/auth" className="text-sm px-4 py-2 rounded-full border border-zinc-700 hover:bg-zinc-800 transition">Sign in</Link>
              <Link to="/auth" className="text-sm px-4 py-2 rounded-full bg-brandYellow text-white font-semibold hover:bg-yellow-400 transition">Sign up</Link>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <Suspense fallback={<Splash />}>
          <Routes>
            {/* 👇 KEY CHANGE: Home switches by auth */}
            <Route path="/" element={user ? <HomeSignedIn /> : <LandingPage />} />

            {/* Clubs list + details */}
            <Route path="/clubs" element={<Clubs />} />
            <Route path="/clubs/:clubParam" element={<ClubProfile />} />

            {/* Chat routes — support both slug-or-id and legacy id */}
            <Route path="/clubs/:clubParam/chat" element={<ClubChat />} />
            <Route path="/club/:clubId/chat" element={<ClubChat />} />

            {/* “/club/:id” legacy → redirect to /clubs/:id */}
            <Route path="/club/:id" element={<ClubSingularRedirect />} />

            {/* Keep legacy variants for existing links */}
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
            <Route path="/search" element={<SearchResults />} />
            <Route path="/create-club" element={<CreateClubWizard />} />
            <Route path="/club-preview" element={<ClubPreview />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/dev/ping" element={<SupabasePing />} />
            <Route path="/clubs/:clubParam/chat" element={<ClubChat />} />
            <Route path="/club/:clubId/chat" element={<ClubChat />} />   {/* legacy */}
            // src/App.js (routes)
            <Route path="/u/:slug" element={<UserProfile />} />
            <Route path="/profile/:id" element={<UserProfile />} />  
    


            {/* ✅ single authoritative route for My Club */}
            <Route path="/myclub" element={<MyClubSmartRedirect />} />

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

export default AppWrapper;








