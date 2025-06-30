import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

function Clubs() {
  const navigate = useNavigate();
  const [hasJoinedClub, setHasJoinedClub] = useState(false); // Replace with real logic

  const [clubs, setClubs] = useState([
    { id: 1, name: 'Cinephiles United', description: 'A club for lovers of indie and foreign films.' },
    { id: 2, name: 'Friday Night Flicks', description: 'We gather every Friday to watch classics and discuss.' },
    { id: 3, name: 'Streaming Junkies', description: 'Focused on streaming-only releases and new hits.' },
  ]);

  const handleSeeMore = (clubId) => {
    navigate(`/club/${clubId}`);
  };
  

  if (!hasJoinedClub) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-yellow-400 mb-10 text-center">🎥 Discover Film Clubs</h1>
        <p className="text-center text-zinc-400 mb-10">Explore clubs and find your perfect film community.</p>
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
              onClick={() => navigate(`/club/${club.id}`)}
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-yellow-400 mb-8 text-center">You're already part of a club</h1>
      <div className="bg-zinc-800 text-white rounded-xl shadow-md p-6 mb-4">
        <h2 className="text-xl font-semibold mb-2">Want to explore more clubs?</h2>
        <p className="text-zinc-400 mb-4">
          Browse more clubs or leave your current one to join another.
        </p>
        <button
          onClick={() => navigate('/clubs')}
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-6 rounded-full"
        >
          Browse Clubs
        </button>
      </div>
    </div>
  );
}

export default Clubs;




  