import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

function MyClub() {
  const navigate = useNavigate();
  const [hasJoinedClub, setHasJoinedClub] = useState(false); // Replace with real logic

  if (!hasJoinedClub) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-yellow-400 mb-4 text-center">🎬 Your Film Club</h1>
        <p className="text-center text-zinc-400 mb-10">
          You haven’t joined a film club yet. Ready to find your people?
        </p>

        {/* Card: Browse Film Clubs */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-lg p-8 text-center mb-8">
          <h2 className="text-2xl font-semibold mb-4">Start Your Cinematic Journey</h2>
          <p className="text-zinc-400 mb-6">
            Explore existing clubs and discover your cinematic tribe.
          </p>
          <button
            onClick={() => navigate('/clubs')}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-3 px-6 rounded-full w-64 mx-auto"
          >
            Browse Film Clubs
          </button>
        </div>

        {/* Separator */}
        <div className="text-center text-zinc-500 font-medium mb-8">or</div>

        {/* Card: Create a Club */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-lg p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">Launch Your Own Club</h2>
          <p className="text-zinc-400 mb-6">
            Want to lead the conversation? Start your own club and invite fellow film lovers.
          </p>
          <button
            onClick={() => navigate('/create-club')}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-3 px-6 rounded-full w-64 mx-auto"
          >
            🎬 Create a Film Club
          </button>
        </div>
      </div>
    );
  }

  // Member view (placeholder for now)
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-yellow-400 mb-8 text-center">Welcome to Your Club</h1>
      {/* Club content for members will go here */}
    </div>
  );
}

export default MyClub;

