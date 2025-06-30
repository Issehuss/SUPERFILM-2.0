import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function CreateClub() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const [clubInfo, setClubInfo] = useState({
    name: '',
    tagline: '',
    about: '',
    location: '',
    theme: 'default',
    banner: null,
    avatar: null,
    visibility: 'open',
    hasMinMembers: false,
  });

  const handleChange = (field, value) => {
    setClubInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (field, file) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setClubInfo((prev) => ({ ...prev, [field]: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const nextStep = () => {
    setStep((prev) => prev + 1);
  };

  const prevStep = () => {
    setStep((prev) => prev - 1);
  };

  useEffect(() => {
    console.log("Current Step:", step);
  }, [step]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-2xl bg-zinc-900 rounded-xl p-8 shadow-2xl relative">

        {/* Step 1: Vision */}
        {step === 1 && (
          <>
            <h2 className="text-3xl font-bold mb-4">🎬 Step 1: Club Vision</h2>
            <input
              type="text"
              placeholder="Club Name"
              value={clubInfo.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full mb-4 p-3 rounded bg-zinc-800 text-white"
            />
            <input
              type="text"
              placeholder="Tagline"
              value={clubInfo.tagline}
              onChange={(e) => handleChange('tagline', e.target.value)}
              className="w-full mb-4 p-3 rounded bg-zinc-800 text-white"
            />
            <textarea
              placeholder="About your club..."
              value={clubInfo.about}
              onChange={(e) => handleChange('about', e.target.value)}
              className="w-full mb-4 p-3 rounded bg-zinc-800 text-white"
              rows={4}
            />
            <input
              type="text"
              placeholder="Location"
              value={clubInfo.location}
              onChange={(e) => handleChange('location', e.target.value)}
              className="w-full mb-6 p-3 rounded bg-zinc-800 text-white"
            />
            <div className="flex justify-end">
              <button
                onClick={nextStep}
                disabled={!clubInfo.name || !clubInfo.about || !clubInfo.location}
                className="bg-yellow-500 text-black font-bold py-2 px-6 rounded-full hover:bg-yellow-400 transition"
              >
                Next →
              </button>
            </div>
          </>
        )}

        {/* Step 2: Theme and Banner */}
        {step === 2 && (
          <>
            <h2 className="text-3xl font-bold mb-6">🎨 Step 2: Style Your Club</h2>

            <label className="block mb-2 text-zinc-300 font-semibold">Choose Theme:</label>
            <select
              value={clubInfo.theme}
              onChange={(e) => handleChange('theme', e.target.value)}
              className="w-full p-3 mb-6 rounded bg-zinc-800 text-white"
            >
              <option value="default">Yellow to Black</option>
              <option value="dark">Dark</option>
              <option value="light">Bright Yellow</option>
              <option value="blue">Blue Gradient</option>
              <option value="purple">Purple to Pink</option>
              <option value="green">Green to Teal</option>
            </select>

            <label className="block mb-2 text-zinc-300 font-semibold">Upload Banner Image:</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload('banner', e.target.files[0])}
              className="mb-6 text-white"
            />
            {clubInfo.banner && (
              <img
                src={clubInfo.banner}
                alt="Banner Preview"
                className="mb-6 w-full h-48 object-cover rounded"
              />
            )}

            <div className="flex justify-between">
              <button
                onClick={prevStep}
                className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-full"
              >
                ← Back
              </button>
              <button
                onClick={nextStep}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-2 rounded-full"
              >
                Next →
              </button>
            </div>
          </>
        )}

        {/* Step 3: Membership Settings */}
        {step === 3 && (
          <>
            <h2 className="text-3xl font-bold mb-6">👥 Step 3: Membership Settings</h2>
            <p className="mb-4 text-zinc-400">Decide if your club requires a minimum number of members before going live.</p>

            <label className="flex items-center mb-6">
              <input
                type="checkbox"
                checked={clubInfo.hasMinMembers}
                onChange={(e) => handleChange('hasMinMembers', e.target.checked)}
                className="mr-2"
              />
              Require at least 3 members before club is visible
            </label>

            <div className="flex justify-between">
              <button
                onClick={prevStep}
                className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-full"
              >
                ← Back
              </button>
              <button
                onClick={() => {
                  console.log("Club created:", clubInfo);
                  navigate('/myclub');
                }}
                className="bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-2 rounded-full"
              >
                🚀 Create Club
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

export default CreateClub;


