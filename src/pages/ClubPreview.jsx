import React from 'react';
import { Upload, MapPin, Film } from 'lucide-react';
import TmdbImage from '../components/TmdbImage';

function ClubPreview() {
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold mb-8">Club Preview</h1>

      {/* Next Screening */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Film className="w-5 h-5 text-yellow-400" /> Next Screening
        </h2>
        <div className="relative w-full aspect-video bg-zinc-800 rounded-lg overflow-hidden">
          <TmdbImage
            src="https://image.tmdb.org/t/p/w500/c1BZv2tzfFfhlzlAWlcz5p9UoFV.jpg"
            alt="Next Screening"
            className="absolute w-full h-full"
            imgClassName="object-cover opacity-70"
          />
          <div className="absolute inset-0 p-4 flex flex-col justify-end bg-gradient-to-t from-black via-transparent to-transparent">
            <h3 className="text-white text-xl font-bold">Screening of "Past Lives"</h3>
            <p className="text-zinc-300 text-sm">June 10, 2024 — Electric Cinema, Notting Hill</p>
          </div>
        </div>
      </section>

      {/* Where We Gather */}
      <section>
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-yellow-400" /> Where We Gather
        </h2>
        <div className="relative w-full aspect-video bg-zinc-800 rounded-lg overflow-hidden">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/7/74/Electric_Cinema_Notting_Hill.jpg"
            alt="Location"
            className="absolute w-full h-full object-cover opacity-70"
          />
        </div>
      </section>
    </div>
  );
}

export default ClubPreview;
