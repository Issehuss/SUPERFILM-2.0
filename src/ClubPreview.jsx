import { useState } from 'react';
import { Upload, Film, MapPin } from 'lucide-react';

// Base64 fallback images
const fallbackNext = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...";
const fallbackLocation = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...";

export default function ClubPreview() {
  const [isAdmin] = useState(true);
  const [club, setClub] = useState({
    nextEvent: {
      title: "Screening of 'Past Lives'",
      date: "2024-06-10",
      location: "Electric Cinema, Notting Hill",
      poster: ""
    },
    locationImage: ""
  });

  const handleImageUpload = (e, section) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setClub(prev => {
        const updated = { ...prev };
        if (section === 'nextEvent') updated.nextEvent.poster = reader.result;
        if (section === 'location') updated.locationImage = reader.result;
        return updated;
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-8 bg-black text-white space-y-12">
      <section>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Film className="w-5 h-5 text-yellow-400" /> Next Screening
        </h2>
        <div className="relative w-full aspect-video bg-zinc-800 rounded-lg overflow-hidden">
          <img
            src={nextScreening.poster || fallbackNext}
            alt={nextScreening.title}
            className="absolute w-full h-full object-cover opacity-70"
          />
          <div className="absolute inset-0 p-4 flex flex-col justify-end bg-gradient-to-t from-black via-transparent to-transparent">
            <h3 className="text-white text-xl font-bold">{nextScreening.title}</h3>
            <p className="text-zinc-300 text-sm">{nextScreening.date} — {nextScreening.location}</p>
          </div>
          {isAdmin && (
            <label className="absolute top-2 right-2 bg-black bg-opacity-50 p-2 rounded-full cursor-pointer">
              <Upload className="w-5 h-5 text-white" />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'nextEvent')}
                className="hidden"
              />
            </label>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-yellow-400" /> Where We Gather
        </h2>
        <div className="relative w-full aspect-video bg-zinc-800 rounded-lg overflow-hidden">
          <img
            src={club.locationImage || fallbackLocation}
            alt="Club Location"
            className="absolute w-full h-full object-cover opacity-70"
          />
          {isAdmin && (
            <label className="absolute top-2 right-2 bg-black bg-opacity-50 p-2 rounded-full cursor-pointer">
              <Upload className="w-5 h-5 text-white" />
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'location')}
                className="hidden"
              />
            </label>
          )}
        </div>
      </section>
    </div>
  );
}
