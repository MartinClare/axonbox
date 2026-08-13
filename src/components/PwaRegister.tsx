"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Drop old SW caches that used to break pages, then register v5
    navigator.serviceWorker
      .getRegistrations()
      .then(async (regs) => {
        for (const reg of regs) {
          try {
            await reg.update();
          } catch {
            /* ignore */
          }
        }
        return navigator.serviceWorker.register("/sw.js");
      })
      .catch(() => undefined);

    if ("caches" in window) {
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => (k.startsWith("axon-case-") || k.startsWith("axonbox-")) && k !== "axonbox-v5")
            .map((k) => caches.delete(k)),
        ),
      );
    }
  }, []);
  return null;
}
