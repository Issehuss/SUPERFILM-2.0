import { useEffect, useState } from "react";

export default function useAppResume() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((v) => v + 1);

    const onVisibility = () => {
      if (document.visibilityState === "visible") bump();
    };

    window.addEventListener("focus", bump);
    window.addEventListener("online", bump);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", bump);
      window.removeEventListener("online", bump);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return tick;
}
