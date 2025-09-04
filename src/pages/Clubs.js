// src/pages/Clubs.js
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabaseClient.js';

function Clubs() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clubs, setClubs] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // ✅ include slug so we can link by slug-or-id
        const { data, error } = await supabase
          .from('clubs')
          .select('id, slug, name, tagline, about')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        if (!cancelled) {
          // Map DB rows → UI clubs with a safe description
          const mapped = (data || []).map((c) => ({
            id: c.id,
            slug: c.slug || null,
            name: c.name,
            description: c.about ?? c.tagline ?? 'A film club for movie lovers.',
          }));
          setClubs(mapped);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Failed to load clubs');
          setClubs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-yellow-400 mb-10 text-center">
          🎥 Discover Film Clubs
        </h1>
        <p className="text-center text-zinc-400">Loading clubs…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-yellow-400 mb-10 text-center">
          🎥 Discover Film Clubs
        </h1>
        <p className="text-center text-red-400">{error}</p>
      </div>
    );
  }

  if (!clubs.length) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-yellow-400 mb-10 text-center">
          🎥 Discover Film Clubs
        </h1>
        <p className="text-center text-zinc-400">No clubs yet. Be the first to create one!</p>
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => navigate('/create-club')}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-6 rounded-full"
          >
            Create a Film Club
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-yellow-400 mb-10 text-center">
        🎥 Discover Film Clubs
      </h1>
      <p className="text-center text-zinc-400 mb-10">
        Explore clubs and find your perfect film community.
      </p>

      <div className="flex flex-col gap-6">
        {clubs.map((club) => (
          <div
            key={club.id}
            className="bg-zinc-800 text-white rounded-xl shadow-md p-6 flex flex-col sm:flex-row justify-between items-center hover:scale-105 transition-transform duration-300"
          >
            <div className="flex-1">
              <h2 className="text-2xl font-semibold mb-2">{club.name}</h2>
              <p className="text-zinc-400 mb-4">{club.description}</p>
            </div>
            <button
              onClick={() => navigate(`/clubs/${club.slug || club.id}`)} // ✅ slug first, fallback to UUID
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-6 rounded-full"
            >
              Learn More
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Clubs;







  