import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { Users, ArrowLeft } from 'lucide-react';

const EventAttendance = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();

  // Get state from navigation or fallback to empty object
  const state = location.state || {};
  const clubName = state.clubName || "Unknown Club";
  const event = state.event || null;
  const clubId = state.clubId || id;

  const [isAttending, setIsAttending] = useState(false);
  const [attendees, setAttendees] = useState([
    { name: "Ava Rahimi", avatar: "/avatars/ava.jpg" },
    { name: "Leo Matsuda", avatar: "/avatars/leo.jpg" },
    { name: "Sara Kim", avatar: "/avatars/sara.jpg" },
  ]);

  if (!event) {
    return (
      <div className="min-h-screen bg-black text-white p-6">
        <p className="text-red-400 font-semibold mb-4">
          Event details not available.
        </p>
        {/* Fallback link */}
        <a
          href={`/clubs/${clubId}`}
          className="text-yellow-400 underline hover:text-yellow-300"
        >
          Go back to {clubName}
        </a>
      </div>
    );
  }

  const handleToggleAttendance = () => {
    setIsAttending(prev => !prev);
    setAttendees(prev =>
      !isAttending
        ? [...prev, { name: "You", avatar: "/avatars/default.jpg" }]
        : prev.filter(a => a.name !== "You")
    );
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)} // ✅ go back in history
        className="flex items-center text-yellow-400 hover:text-yellow-300 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Club
      </button>

      {/* Event header */}
      <h1 className="text-3xl font-bold mb-2">{event.title}</h1>
      <p className="text-zinc-400">
        {clubName} — {new Date(event.date).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}
      </p>

      {/* Attendance count */}
      <div className="mt-6 flex items-center gap-3">
        <Users className="w-5 h-5 text-yellow-400" />
        <span>{attendees.length} members attending</span>
      </div>

      {/* Join / Leave button */}
      <button
        onClick={handleToggleAttendance}
        className={`mt-4 px-4 py-2 rounded-lg font-semibold ${
          isAttending ? 'bg-red-500 hover:bg-red-400' : 'bg-yellow-500 hover:bg-yellow-400'
        }`}
      >
        {isAttending ? 'Leave Attendance' : 'Join Attendance'}
      </button>

      {/* Attendee avatars */}
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {attendees.map((person, index) => (
          <div key={index} className="text-center">
            <img
              src={person.avatar}
              alt={person.name}
              className="w-16 h-16 rounded-full mx-auto border-2 border-yellow-500 object-cover"
            />
            <p className="mt-2 text-sm">{person.name}</p>
          </div>
        ))}
      </div>

      {/* Optional fallback link if user opened this page directly */}
      <div className="mt-6">
        <a
          href={`/clubs/${clubId}`}
          className="text-zinc-400 text-xs underline hover:text-yellow-400"
        >
          Go to club page
        </a>
      </div>
    </div>
  );
};

export default EventAttendance;

