// src/components/ProfileSkeleton.jsx
export default function ProfileSkeleton() {
  return (
    <div className="w-full bg-black text-white py-8 px-4">
      <div className="mx-auto max-w-6xl">
        <div className="h-36 sm:h-52 rounded-2xl bg-zinc-900/70 animate-pulse" />

        <div className="-mt-10 flex items-end gap-4 px-2 sm:px-4">
          <div className="h-20 w-20 sm:h-28 sm:w-28 rounded-full bg-zinc-800 animate-pulse border border-zinc-700" />
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-zinc-800 animate-pulse" />
            <div className="h-3 w-28 rounded bg-zinc-800 animate-pulse" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 px-2 sm:px-4">
          <div className="h-24 rounded-2xl bg-zinc-900/70 animate-pulse" />
          <div className="h-24 rounded-2xl bg-zinc-900/70 animate-pulse" />
          <div className="h-24 rounded-2xl bg-zinc-900/70 animate-pulse" />
        </div>

        <div className="mt-6 px-2 sm:px-4 space-y-3">
          <div className="h-4 w-32 rounded bg-zinc-800 animate-pulse" />
          <div className="h-24 rounded-2xl bg-zinc-900/70 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
