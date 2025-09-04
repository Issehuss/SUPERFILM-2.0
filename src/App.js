// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import debounce from 'lodash.debounce';

import MovieDetails from './pages/MovieDetails';
import SearchResults from './pages/SearchResults';
import Clubs from './pages/Clubs';
import Movies from './pages/Movies';
import ClubProfile from './pages/ClubProfile';
import MembersPage from './pages/MembersPage';
import UserProfile from './pages/UserProfile.jsx';
import CreateClubWizard from './pages/CreateClubWizard';
import ClubEventDetails from './pages/ClubEventDetails';
import ClubPreview from './pages/ClubPreview'; 
<<<<<<< HEAD
import Clubs2 from './pages/Clubs2';
=======
import EventAttendance from './pages/EventAttendance';
import SupabasePing from "./dev/SupabasePing";
import AuthPage from './pages/AuthPage';
import MyClub from './pages/MyClub';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/Home';
>>>>>>> 678cfbc (WIP:saving my local edits)

import { UserProvider, useUser } from './context/UserContext';
import './styles/glows.css';

/* --- Redirect helpers --- */
function ClubSingularRedirect() {
  const { id } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    if (id) navigate(`/clubs/${id}`, { replace: true });
  }, [id, navigate]);
  return null;
}

function MyClubRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    const stored = localStorage.getItem("myClubId");
    const fallback = "1"; // dev fallback
    navigate(`/clubs/${stored || fallback}`, { replace: true });
  }, [navigate]);
  return null;
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

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white font-sans">
      <header className="flex items-center justify-between p-6 bg-zinc-950 shadow-md">
        <div className="flex flex-col items-start">
          <h1 className="text-3xl font-bold tracking-wide">SuperFilm</h1>
          <p className="text-sm text-zinc-400 mt-1">Connect through cinema.</p>
        </div>

        <nav className="flex gap-12 mx-auto text-white">
          <Link className="hover:text-yellow-400 transition" to="/">Home</Link>
          <Link className="hover:text-yellow-400 transition" to="/clubs">Clubs</Link>
           <Link className="hover:text-yellow-400 transition" to="/clubs-2">Clubs 2</Link>
          <Link className="hover:text-yellow-400 transition" to="/myclub">My Club</Link>
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
        <Routes>
          <Route path="/" element={user === null ? <LandingPage /> : <HomePage />} />
          <Route path="/clubs" element={<Clubs />} />
          <Route path="/movies" element={<Movies searchQuery={searchQuery} />} />

          {/* UPDATED: allow slug or UUID */}
          <Route path="/clubs/:clubParam" element={<ClubProfile />} />

          {/* Keep existing singular redirect */}
          <Route path="/club/:id" element={<ClubSingularRedirect />} />
          <Route path="/club/:id/members" element={<MembersPage />} />
<<<<<<< HEAD
          <Route path="/clubs-2" element={<Clubs2 />} />
          <Route path="/profile" element={<UserProfile />} />
=======
          <Route path="/club/:id/event/:eventSlug" element={<ClubEventDetails />} />

          {/* NEW: parallel “clubs/…” routes for nested pages (keep old ones too) */}
          <Route path="/clubs/:clubParam/events/next" element={<EventAttendance />} />
          <Route path="/clubs/:clubParam/members" element={<MembersPage />} />

          {/* Keep your existing “clubs/:id/events/next” so old links keep working */}
          <Route path="/clubs/:id/events/next" element={<EventAttendance />} />

          <Route path="/profile" element={<UserProfile key={window.location.search} />} />
>>>>>>> 678cfbc (WIP:saving my local edits)
          <Route path="/movie/:id" element={<MovieDetails />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/create-club" element={<CreateClubWizard />} />
          <Route path="/club-preview" element={<ClubPreview />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/dev/ping" element={<SupabasePing />} />
          <Route path="/myclub" element={<MyClub />} />
        </Routes>
      </main>

      <footer className="text-center text-sm text-zinc-500 p-4 border-t border-zinc-800 mt-8">
        © {new Date().getFullYear()} SuperFilm. All rights reserved.
      </footer>
    </div>
  );
}

export default AppWrapper;










