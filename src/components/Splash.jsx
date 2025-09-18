// src/components/Splash.jsx
export default function Splash({ message = "Please wait…" }) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/superfilm-logo.jpg"   
            alt="SuperFilm"
            width="96"
            height="96"
            loading="eager"
            decoding="async"
            fetchpriority="high"
          />
          <p className="text-zinc-300">{message}</p>
        </div>
      </div>
    );
  }
  
  