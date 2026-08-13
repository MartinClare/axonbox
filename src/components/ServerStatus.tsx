"use client";

import { useEffect, useState } from "react";

/**
 * Soft banner when the backend is unreachable — common after process exit.
 */
export function ServerStatus() {
  const [down, setDown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let fails = 0;

    async function ping() {
      try {
        const res = await fetch(`/api/health?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("bad");
        fails = 0;
        if (!cancelled) setDown(false);
      } catch {
        fails += 1;
        if (!cancelled && fails >= 2) setDown(true);
      }
    }

    ping();
    const id = setInterval(ping, 12_000);
    const onFocus = () => ping();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (!down) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] bg-[var(--axon-signal)] px-3 py-2 text-center text-xs font-semibold text-[var(--axon-ink)] shadow">
      無法連上伺服器。請執行{" "}
      <code className="rounded bg-white/50 px-1">npm run start:daemon</code>
      ，然後{" "}
      <button type="button" className="underline" onClick={() => window.location.reload()}>
        重新整理
      </button>
    </div>
  );
}
