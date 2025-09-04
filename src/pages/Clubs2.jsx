import React from 'react';
import { Link } from 'react-router-dom';

import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/navigation';
import { Navigation, Mousewheel, Keyboard } from 'swiper/modules';

import '../App.css';
import './Clubs2.css';

const baseClubs = [
  { id: '1', name: 'Club 001', image: '/club-images/Club1-PFP.jpeg' },
  { id: '2', name: 'Club 002', image: '/club-images/Club2-PFP.jpeg' },
  { id: '3', name: 'Club 003', image: '/club-images/Club3-PFP.jpeg' },
  { id: '4', name: 'Club 004', image: '/club-images/Club4-PFP.jpeg' },
  { id: '5', name: 'Club 005', image: '/club-images/Club5-PFP.jpeg' },
  { id: '6', name: 'Club 006', image: '/club-images/Club6-PFP.jpeg' },
  { id: '7', name: 'Club 007', image: '/club-images/Club7-PFP.jpeg' },
  { id: '8', name: 'Club 008', image: '/club-images/Club8-PFP.jpeg' },
  { id: '9', name: 'Club 009', image: '/club-images/Club9-PFP.jpeg' },
  { id: '10', name: 'Club 010', image: '/club-images/Club10-PFP.jpeg' },
];

const popularClubs = [...baseClubs, ...baseClubs]; // duplicate for loop stability

const swiperConfig = {
  modules: [Navigation, Mousewheel, Keyboard],
  slidesPerView: 'auto',
  spaceBetween: 16,
  navigation: true,
  loop: true,
  loopedSlides: popularClubs.length,
  grabCursor: true,
  simulateTouch: true,
  threshold: 5,
  mousewheel: {
    forceToAxis: true,
    releaseOnEdges: false,
    sensitivity: 0.6,
  },
  keyboard: {
    enabled: true,
    onlyInViewport: true,
  },
};

export default function Clubs2() {
  return (
    <div className="clubs2 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]
                   xl:grid xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-6
                   h-[calc(100vh-88px)] overflow-hidden">

      <aside className="hidden xl:block w-64 h-full overflow-y-auto px-4 pt-8 pb-8
                          bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl
                          text-sm text-zinc-300">
        <div>
          <h3 className="text-white text-lg font-semibold mb-2">Editor's Pick</h3>
          <div className="bg-zinc-800 p-3 rounded-lg shadow mb-4">
            <p className="text-white font-medium">Cinema Club</p>
            <p className="text-xs mt-1 text-zinc-400">New short film collab this week.</p>
          </div>
          <div className="bg-zinc-800 p-3 rounded-lg shadow">
            <p className="text-white font-medium">Critic's Choice</p>
            <p className="text-xs mt-1 text-zinc-400">A24 Fans Group Meeting Soon</p>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-white text-lg font-semibold mb-2">Explore</h3>
          <ul className="space-y-2">
            <li><Link to="/events" className="text-white hover:text-zinc-300">Events</Link></li>
            <li><Link to="/my-club" className="text-white hover:text-zinc-300">My Club</Link></li>
            <li><Link to="/create-club" className="text-white hover:text-zinc-300">Create Club</Link></li>
            <li><Link to="/search" className="text-white hover:text-zinc-300">Search Clubs</Link></li>
            <li><Link to="/leaderboard" className="text-white hover:text-zinc-300">Leaderboard</Link></li>
          </ul>
        </div>
      </aside>

      <main className="relative flex-1 min-w-0 h-full overflow-y-auto pr-6 pt-8
                      bg-gradient-to-b from-zinc-900 via-black to-zinc-900">
        <div className="flex items-end justify-between mb-4 pr-2">
          <div>
            <h2 className="text-3xl font-bold mb-1">Popular</h2>
            <p className="text-sm text-zinc-400">Scroll to explore more</p>
          </div>
        </div>

        <section className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-5 overflow-hidden">
          <Swiper {...swiperConfig} className="!w-full">
            {popularClubs.map((club, index) => (
              <SwiperSlide key={`popular-${index}`} className="!w-[220px]">
                <Link to={`/club/${club.id}`} className="block bg-zinc-800 rounded-lg border border-zinc-700 shadow-md hover:shadow-yellow-500/20 hover:border-zinc-500 transition-transform duration-300 ease-out hover:scale-105">
                  <div className="w-full h-56 bg-zinc-700 rounded-t-lg overflow-hidden">
                    <img
                      src={club.image}
                      alt={club.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/300x160?text=Coming+Soon'; }}
                    />
                  </div>
                  <div className="p-3 text-white text-lg font-semibold">{club.name}</div>
                </Link>
              </SwiperSlide>
            ))}
          </Swiper>
        </section>
      </main>
    </div>
  );
}