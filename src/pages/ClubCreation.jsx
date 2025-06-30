import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function ClubCreation() {
  const [clubName, setClubName] = useState('');
  const navigate = useNavigate();

  const handleNext = () => {
    if (clubName.trim()) {
      // Store club name in local/session storage or context (temporary step handling)
      sessionStorage.setItem('newClubName', clubName);
      navigate('/create-club/step-2');
    } else {
      alert('Please enter a club name before continuing.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-black to-zinc-900 text-white p-6">
      <div className="bg-zinc-800 w-full max-w-3xl p-10 rounded-2xl shadow-lg text-center">
        <h1 className="text-4xl font-bold mb-4">🎬 Launch Your Film Club</h1>
        <p className="text-zinc-400 mb-8 text-lg">Step 1: What’s your club called?</p>

        <input
          type="text"
          value={clubName}
          onChange={(e) => setClubName(e.target.value)}
          placeholder="e.g. The Cinephiles Circle"
          className="w-full bg-zinc-700 text-white p-4 text-lg rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-6"
        />

        <button
          onClick={handleNext}
          className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-6 py-3 rounded-full text-lg transition"
        >
          ➡️ Next
        </button>
      </div>
    </div>
  );
}

export default ClubCreation;

  