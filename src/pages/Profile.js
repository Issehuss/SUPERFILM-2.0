import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { User, Film, Star, Users, CalendarDays, Pencil } from 'lucide-react';

function UserProfile() {
  const { username } = useParams();
  const [user, setUser] = useState(null);
  const [isCurrentUser, setIsCurrentUser] = useState(true); // Mock check
  const [editMode, setEditMode] = useState(false);


  <button
  onClick={() => setEditMode(!editMode)}
  className="bg-blue-600 text-white px-4 py-2 rounded-md"
>
  {editMode ? "Done" : "Edit Profile"}
</button>


  useEffect(() => {
    // Mock data
    const mockUser = {
      username: "cinemaLover99",
      profilePic: "https://i.pravatar.cc/100",
      bio: "Lover of slow cinema and rainy day screenings.",
      club: {
        name: "Indie Reels",
        id: 1
      },
      watchlist: ["Past Lives", "Drive My Car", "Portrait of a Lady on Fire"],
      suggestions: ["Taste of Cherry", "Columbus"],
      eventsAttended: [
        { title: "Aftersun Screening", date: "2024-05-10" },
        { title: "Screening of 'Past Lives'", date: "2024-06-10" }
      ]
    };

    setUser(mockUser);
  }, [username]);

  if (!user) return <p className="text-white text-center mt-20">Loading profile...</p>;

  return (
    <div className="p-6 max-w-4xl mx-auto text-white space-y-8">
      {/* Profile Header */}
      <div className="flex items-center gap-6 bg-zinc-900 p-6 rounded-xl shadow-md">
        <img
          src={user.profilePic}
          alt="Profile"
          className="w-24 h-24 rounded-full object-cover border-4 border-yellow-500"
        />
        <div>
          <h1 className="text-3xl font-bold">{user.username}</h1>
          <p className="text-zinc-300 italic mt-1">{user.bio}</p>
          {isCurrentUser && (
            <button className="mt-2 flex items-center gap-1 text-sm bg-yellow-500 text-black px-3 py-1 rounded-full hover:bg-yellow-400 transition">
              <Pencil className="w-4 h-4" /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Club Affiliation */}
      <div className="bg-zinc-900 p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <Users className="w-5 h-5" /> Member of
        </h2>
        <p className="text-lg text-yellow-400">{user.club.name}</p>
      </div>

      {/* Watchlist */}
      <div className="bg-zinc-900 p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <Star className="w-5 h-5" /> Watchlist
        </h2>
        <ul className="list-disc pl-6 text-zinc-300">
          {user.watchlist.map((film, index) => <li key={index}>{film}</li>)}
        </ul>
      </div>

      {/* Suggested Films */}
      <div className="bg-zinc-900 p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <Film className="w-5 h-5" /> Suggested Films
        </h2>
        <ul className="list-disc pl-6 text-zinc-300">
          {user.suggestions.map((film, index) => <li key={index}>{film}</li>)}
        </ul>
      </div>

      {/* Events Attended */}
      <div className="bg-zinc-900 p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
          <CalendarDays className="w-5 h-5" /> Events Attended
        </h2>
        <ul className="text-zinc-300">
          {user.eventsAttended.map((event, index) => (
            <li key={index} className="mb-1">
              <strong>{event.title}</strong> — {event.date}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default UserProfile;
