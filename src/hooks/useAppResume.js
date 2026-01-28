import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const AppResumeContext = createContext({ appResumeTick: 0, ready: false });

export function AppResumeProvider({ children }) {
  const [ready, setReady] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.visibilityState === "visible";
  });
  const [tick, setTick] = useState(0);
  const lastResumeAtRef = useRef(0);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") {
      return () => {};
    }

    let mounted = true;

    const bumpTick = () => {
      if (!mounted) return false;
      if (document.visibilityState !== "visible") {
        setReady(false);
        return false;
      }
      const now = Date.now();
      if (now - lastResumeAtRef.current < 500) {
        return false;
      }
      lastResumeAtRef.current = now;
      setReady(true);
      setTick((prev) => prev + 1);
      return true;
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        bumpTick();
      } else {
        setReady(false);
      }
    };

    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        bumpTick();
      }
    };

    const handlePageShow = (event) => {
      if (document.visibilityState === "visible") {
        bumpTick();
      }
    };

    const attachListeners = () => {
      window.addEventListener("focus", handleFocus);
      window.addEventListener("pageshow", handlePageShow);
      document.addEventListener("visibilitychange", handleVisibility);
    };

    const detachListeners = () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibility);
    };

    attachListeners();
    bumpTick();

    return () => {
      mounted = false;
      detachListeners();
    };
  }, []);

  const value = useMemo(
    () => ({ appResumeTick: tick, ready }),
    [ready, tick]
  );

  return <AppResumeContext.Provider value={value}>{children}</AppResumeContext.Provider>;
}

export default function useAppResume() {
  return useContext(AppResumeContext);
}
