import ClubCard from '../components/ClubCard';

const ClubsPage = () => {
  const clubs = [
    {
      name: "Film Poets",
      description: "A club for lovers of quiet, poetic cinema.",
      image: "/banners/poetic.jpg"
    },
    // more clubs...
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      {clubs.map((club, i) => (
        <ClubCard
          key={i}
          name={club.name}
          description={club.description}
          image={club.image}
        />
      ))}
    </div>
  );
};

export default ClubCard;
