export default function RoleBadge({ role }) {
  if (!role || role === "member") return null;
  const labels = {
    president: "President",
    vice_president: "Vice-President",
  };
    return (
      <span className="ml-2 inline-flex items-center rounded-full border border-yellow-400/40 bg-yellow-400/10 px-2 py-0.5 text-xs">
        {labels[role] || role}
      </span>
    );
  }
  
