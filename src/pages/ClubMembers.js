import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { MapPin, Users } from 'lucide-react';

function ClubMembers() {
  const { id } = useParams();
  const [club, setClub] = useState(null);

  useEffect(() => {
    // Mock data for demonstration
    const mockClubs = [
      {
        id: 1,
        location: "Electric Cinema, Notting Hill",
        members: [
          { name: "Alice", avatar: "/avatars/alice.png" },
          { name: "Bob", avatar: "/avatars/bob.png" },
          { name: "Charlie", avatar: "/avatars/charlie.png" },
          { name: "Daisy", avatar: "/avatars/daisy.png" },
          { name: "Eve", avatar: "/avatars/eve.png" },
        ]
      },
      {
        id: 2,
        location: "Manchester Odeon",
        members: [
          { name: "Frank", avatar: "/avatars/frank.png" },
          { name: "Grace", avatar: "/avatars/grace.png" }
        ]
      }
    ];

    const foundClub = mockClubs.find(c => c.id === Number(id));
    setClub(foundClub);
  }, [id]);

  if (!club) return <p className="text-white text-center mt-20">Loading club members...</p>;

  return (
    <div className="p-6 max-w-6xl mx-auto text-white space-y-8">
      {/* Location Info */}
      <div className="bg-gradient-to-br from-zinc-800 via-zinc-900 to-black p-6 rounded-xl shadow-md">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2"><MapPin /> Where We Gather</h2>
        <p className="text-zinc-300 text-lg">📍 {club.location}</p>
      </div>

      {/* Members Grid */}
      <div className="bg-gradient-to-br from-yellow-500 via-yellow-400 to-yellow-300 p-6 rounded-xl shadow-md">
        <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2"><Users className="text-black" /> Meet the Club</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
          {club.members.map((member, index) => (
            <div
              key={index}
              className="bg-white text-black rounded-xl shadow hover:scale-105 transition-transform p-4 flex flex-col items-center"
            >
              <img
                src={member.avatar}
                alt={member.name}
                className="w-20 h-20 object-cover rounded-lg mb-2"
              />
              <p className="font-semibold">{member.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ClubMembers;
