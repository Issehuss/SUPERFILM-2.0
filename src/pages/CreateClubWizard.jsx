// src/pages/CreateClubWizard.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@supabase/auth-helpers-react'; // keep if you want; we also hard-check Supabase directly
import supabase from '../supabaseClient.js';

const ROLE = {
  PRESIDENT: 'president',
  VICE: 'vice_president',
  NONE: null,
};

// ✅ simple slug generator (lowercase, dashed, trimmed)
const slugify = (s) =>
  (s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);

function CreateClubWizard() {
  const navigate = useNavigate();
  const user = useUser(); // may be briefly null; we won’t rely on this alone
  const [step, setStep] = useState(1);
  const [clubData, setClubData] = useState({
    name: '',
    tagline: '',
    about: '',
    location: '',
    type: '',
    toneFilm: '',
    welcomeMessage: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field, value) => {
    setClubData((prev) => ({ ...prev, [field]: value }));
  };

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  // ---- SUBMIT: create club -> seed president -> navigate ----
  const handleSubmit = async () => {
    if (isSaving) return;

    // 0) Validate required fields first
    if (!clubData.name || !clubData.tagline || !clubData.about || !clubData.location || !clubData.type) {
      alert('Please complete all required fields.');
      return;
    }

    setIsSaving(true);
    try {
      // 1) ✅ Pull the freshest auth directly from Supabase (don’t rely on React timing)
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const uid = authData?.user?.id || user?.id; // fall back to hook if present
      if (!uid) {
        alert('Please sign in first.');
        setIsSaving(false);
        return;
      }

      // 2) Build slug now, so we can navigate by it immediately
      const slug = slugify(clubData.name);

      // 3) Create the club (include only columns that exist in your schema)
      //    NOTE: type/toneFilm/welcomeMessage are kept in UI but NOT sent to DB unless you add columns.
      const { data: club, error: clubErr } = await supabase
        .from('clubs')
        .insert([{
          name: clubData.name,
          slug,
          tagline: clubData.tagline,
          about: clubData.about,
          location: clubData.location,
          owner_id: uid,            // important for RLS + trigger
          is_published: false,      // start unpublished; policies allow leaders/owner to read/edit
          // banner_url: null,      // optional to set now
          // next_screening_*: ...  // set later in profile editor
          // featured_posters: []   // set later in profile editor
        }])
        .select('id, slug')
        .single();

      if (clubErr) {
        console.error('[CreateClub] Insert error:', clubErr);
        alert(`Could not create club: ${clubErr.message}`);
        setIsSaving(false);
        return;
      }

      if (!club?.id) {
        // Insert worked but RLS prevented returning row (rare if select policy missing).
        console.warn('[CreateClub] No club id returned (likely RLS select policy).');
        alert('Club created, but we could not retrieve its id. Redirecting to My Club…');
        setIsSaving(false);
        navigate('/myclub', { replace: true });
        return;
      }

      // 4) Seed the creator as PRESIDENT in club_members
      //    If you added the DB trigger, this will just no-op via upsert.
      const { error: memberErr } = await supabase
        .from('club_members')
        .upsert(
          { club_id: club.id, user_id: uid, role: ROLE.PRESIDENT },
          { onConflict: 'club_id,user_id' }
        );

      if (memberErr) {
        console.error('[CreateClub] Seed president error:', memberErr);
        // Don’t block navigation — the trigger may have done it; you can still continue.
        alert(`Club created, but failed to set your role (president): ${memberErr.message}`);
      }

      // 5) Store for redirects and navigate to pretty URL
      const target = club.slug || club.id;
      localStorage.setItem('activeClubId', String(club.id));
      localStorage.setItem('activeClubSlug', String(target));
      localStorage.setItem('myClubId', String(target)); // if you use MyClubRedirect
      setIsSaving(false);
      navigate(`/clubs/${target}`, { replace: true });
    } catch (e) {
      console.error('[CreateClub] Unexpected error:', e);
      alert(e?.message || 'Unexpected error creating club.');
      setIsSaving(false);
    }
  };

  const stepColors = [
    'from-yellow-500 to-yellow-700',
    'from-indigo-500 to-indigo-700',
    'from-pink-500 to-pink-700',
    'from-green-500 to-green-700',
    'from-blue-500 to-blue-700',
    'from-red-500 to-red-700',
    'from-purple-500 to-purple-700'
  ];

  return (
    <div className={`min-h-screen bg-gradient-to-br ${stepColors[step - 1]} flex items-center justify-center px-4 rounded-3xl`}>
      <div className="w-full max-w-2xl bg-black bg-opacity-80 rounded-2xl p-10 shadow-2xl text-white relative">
        <h1 className="text-4xl font-bold text-center mb-10">🎬 Create Your Club</h1>

        {/* Step 1: Club Name */}
        {step === 1 && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Step 1: What's your club called?</h2>
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
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-6 rounded-full disabled:opacity-60"
              >Next →</button>
            </div>
          </>
        )}

        {/* Step 2: Tagline */}
        {step === 2 && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Step 2: A short tagline for your vibe</h2>
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
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-6 rounded-full disabled:opacity-60"
              >Next →</button>
            </div>
          </>
        )}

        {/* Step 3: About the Club */}
        {step === 3 && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Step 3: What is your club about?</h2>
            <textarea
              placeholder="Tell future members what kind of cinema this club is for."
              value={clubData.about}
              onChange={(e) => handleChange('about', e.target.value)}
              className="w-full p-4 rounded-lg bg-zinc-800 text-white mb-6 h-32"
            />
            <div className="flex justify-between">
              <button onClick={prevStep} className="text-zinc-400 hover:text-white">← Back</button>
              <button
                onClick={nextStep}
                disabled={!clubData.about}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-6 rounded-full disabled:opacity-60"
              >Next →</button>
            </div>
          </>
        )}

        {/* Step 4: Location */}
        {step === 4 && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Step 4: Where in the world is your club?</h2>
            <input
              type="text"
              placeholder="City or country (or 'Online')"
              value={clubData.location}
              onChange={(e) => handleChange('location', e.target.value)}
              className="w-full p-4 rounded-lg bg-zinc-800 text-white mb-6"
            />
            <div className="flex justify-between">
              <button onClick={prevStep} className="text-zinc-400 hover:text-white">← Back</button>
              <button
                onClick={nextStep}
                disabled={!clubData.location}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-6 rounded-full disabled:opacity-60"
              >Next →</button>
            </div>
          </>
        )}

        {/* Step 5: Type */}
        {step === 5 && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Step 5: Is this an in-person club or online?</h2>
            <select
              value={clubData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="w-full p-4 rounded-lg bg-zinc-800 text-white mb-6"
            >
              <option value="">Select type...</option>
              <option value="Local">Local (In-person)</option>
              <option value="Online">Online</option>
              <option value="Hybrid">Hybrid</option>
            </select>
            <div className="flex justify-between">
              <button onClick={prevStep} className="text-zinc-400 hover:text-white">← Back</button>
              <button
                onClick={nextStep}
                disabled={!clubData.type}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-6 rounded-full disabled:opacity-60"
              >Next →</button>
            </div>
          </>
        )}

        {/* Step 6: Tone-setting Film (Optional) */}
        {step === 6 && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Step 6 (Optional): Pick a film that sets the tone</h2>
            <input
              type="text"
              placeholder="e.g. Taste of Cherry, La Haine, Daisies..."
              value={clubData.toneFilm}
              onChange={(e) => handleChange('toneFilm', e.target.value)}
              className="w-full p-4 rounded-lg bg-zinc-800 text-white mb-6"
            />
            <div className="flex justify-between">
              <button onClick={prevStep} className="text-zinc-400 hover:text-white">← Back</button>
              <button
                onClick={nextStep}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 px-6 rounded-full"
              >Next →</button>
            </div>
          </>
        )}

        {/* Step 7: Welcome Message */}
        {step === 7 && (
          <>
            <h2 className="text-2xl font-semibold mb-4">Step 7: Welcome Message or Manifesto</h2>
            <textarea
              placeholder="Write a short welcome or manifesto for your club."
              value={clubData.welcomeMessage}
              onChange={(e) => handleChange('welcomeMessage', e.target.value)}
              className="w-full p-4 rounded-lg bg-zinc-800 text-white mb-6 h-28"
            />
            <div className="flex justify-between items-center">
              <button onClick={prevStep} className="text-zinc-400 hover:text-white">← Back</button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="bg-green-500 hover:bg-green-600 text-black font-semibold py-2 px-6 rounded-full disabled:opacity-60"
              >
                {isSaving ? 'Creating…' : '✅ Create Club'}
              </button>
            </div>
            <p className="mt-3 text-xs text-zinc-400">
              You’ll start as <span className="text-yellow-400 font-semibold">President</span>. You can promote a Vice President later.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default CreateClubWizard;







