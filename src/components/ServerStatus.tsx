"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";

/**
 * Soft banner when the backend is unreachable — common after process exit.
 */
export function ServerStatus() {
  const { t } = useI18n();
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
      {t("server.down")}{" "}
      <code className="rounded bg-white/50 px-1">npm run start:daemon</code>
      {t("server.then")}
      <button type="button" className="underline" onClick={() => window.location.reload()}>
        {t("server.refresh")}
      </button>
    </div>
  );
}
