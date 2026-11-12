import { useEffect, useState } from "react";

/** Current time, refreshed on an interval so relative labels stay accurate. */
export function useNow(intervalMs = 5_000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
