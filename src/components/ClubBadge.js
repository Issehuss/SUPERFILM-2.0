import React from 'react';
import { Link } from 'react-router-dom';

const ClubBadge = ({ clubName }) => {
  if (!clubName) return null;

  return (
    <Link to={`/clubs/${clubName.toLowerCase().replace(/\s+/g, '-')}`}>
      <span className="inline-block mt-2 bg-indigo-600 text-white text-xs font-medium px-3 py-1 rounded-full shadow-sm hover:brightness-110 transition">
        🎬 {clubName}
      </span>
    </Link>
  );
};

export default ClubBadge;

