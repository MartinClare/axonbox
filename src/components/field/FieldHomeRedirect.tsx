"use client";

import { useEffect } from "react";

/** Phones and installed PWA open the field app instead of the desktop dashboard. */
export function FieldHomeRedirect() {
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("desktop") === "1") return;
    const phone = window.matchMedia("(max-width: 767px)").matches;
    const pwa = window.matchMedia("(display-mode: standalone)").matches;
    if (phone || pwa) window.location.replace("/m");
  }, []);
  return null;
}
