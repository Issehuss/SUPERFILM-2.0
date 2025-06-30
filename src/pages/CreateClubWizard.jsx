import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function CreateClubWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [clubData, setClubData] = useState({
    name: '',
    tagline: '',
    about: '',
    location: '',
  });

  const handleChange = (field, value) => {
    setClubData((prev) => ({ ...prev, [field]: value }));
  };

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  const handleSubmit = () => {
    console.log('Creating club with data:', clubData);
    navigate('/myclub');
  };

  const stepColors = [
    'from-yellow-500 to-yellow-700',
    'from-indigo-500 to-indigo-700',
    'from-pink-500 to-pink-700',
    'from-green-500 to-green-700',
  ];

  return (
    <div className={`min-h-screen bg-gradient-to-br ${stepColors[step - 1]} flex items-center justify-center px-4 rounded-3xl`}> {/* ✅ Added curved edges to outer background */}
      <div className="w-full max-w-2xl bg-black bg-opacity-80 rounded-2xl p-10 shadow-2xl text-white relative">
        <h1 className="text-4xl font-bold text-center mb-10">🎬 Create Your Club</h1>

        {/* Step 1 */}
        {step === 1 && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Step 1: Club Name</h2>
            <input
              type="text"
              placeholder="Enter your club's name"
              value={clubData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full p-4 rounded-lg bg-zinc-800 text-white mb-6"
            />
            <div className="flex justify-end">
              <button
                onClick={nextStep}
                disabled={!clubData.name}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-6 rounded-full"
              >
                Next →
              </button>
            </div>
          </>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Step 2: Tagline</h2>
            <input
              type="text"
              placeholder="Enter a short tagline"
              value={clubData.tagline}
              onChange={(e) => handleChange('tagline', e.target.value)}
              className="w-full p-4 rounded-lg bg-zinc-800 text-white mb-6"
            />
            <div className="flex justify-between">
              <button onClick={prevStep} className="text-zinc-400 hover:text-white">← Back</button>
              <button
                onClick={nextStep}
                disabled={!clubData.tagline}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-6 rounded-full"
              >
                Next →
              </button>
            </div>
          </>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Step 3: About Your Club</h2>
            <textarea
              placeholder="Tell us what your club is all about"
              value={clubData.about}
              onChange={(e) => handleChange('about', e.target.value)}
              className="w-full p-4 rounded-lg bg-zinc-800 text-white mb-6 h-32"
            />
            <div className="flex justify-between">
              <button onClick={prevStep} className="text-zinc-400 hover:text-white">← Back</button>
              <button
                onClick={nextStep}
                disabled={!clubData.about}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-6 rounded-full"
              >
                Next →
              </button>
            </div>
          </>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Step 4: Location</h2>
            <input
              type="text"
              placeholder="Where will your club meet?"
              value={clubData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              className="w-full p-4 rounded-lg bg-zinc-800 text-white mb-6"
            />
            <div className="flex justify-between">
              <button onClick={prevStep} className="text-zinc-400 hover:text-white">← Back</button>
              <button
                onClick={handleSubmit}
                disabled={!clubData.location}
                className="bg-green-500 hover:bg-green-600 text-black font-semibold py-2 px-6 rounded-full"
              >
                ✅ Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default CreateClubWizard;


