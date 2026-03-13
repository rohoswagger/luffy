import { useState, useEffect } from "react";

/** Returns a Date that updates on a fixed interval (default 30s). */
export function useClock(intervalMs = 30_000): Date {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
