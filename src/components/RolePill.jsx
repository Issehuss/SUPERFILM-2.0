export default function RolePill({ role }) {
    if (!role) return null;
  const label = role === 'president'
    ? 'President'
    : role === 'vice_president'
    ? 'Vice President'
    : null;
    if (!label) return null;
  
  const cls =
    role === 'president'
      ? 'border-yellow-400 text-yellow-300'
      : role === 'vice_president'
      ? 'border-zinc-500 text-zinc-300'
      : '';
  
    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>
        {label}
      </span>
    );
  }
  
