"use client";

import { useMemo } from "react";
import {
  DEFAULT_UI_LOCALE,
  normalizeUiLocale,
  UI_LOCALE_COOKIE,
  UI_LOCALE_STORAGE_KEY,
  type UiLocale,
} from "@/lib/i18n/types";
import { translate } from "@/lib/i18n/messages";

function readLocale(): UiLocale {
  if (typeof window === "undefined") return DEFAULT_UI_LOCALE;
  try {
    const fromStore = window.localStorage.getItem(UI_LOCALE_STORAGE_KEY);
    if (fromStore) return normalizeUiLocale(fromStore);
    const match = document.cookie.match(new RegExp(`(?:^|; )${UI_LOCALE_COOKIE}=([^;]*)`));
    if (match?.[1]) return normalizeUiLocale(decodeURIComponent(match[1]));
  } catch {
    /* ignore */
  }
  return DEFAULT_UI_LOCALE;
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useMemo(() => readLocale(), []);
  const t = (key: string) => translate(locale, key);
  const lang = locale === "en" ? "en" : "zh-Hant";

  return (
    <html lang={lang}>
      <body
        style={{
          fontFamily:
            locale === "en"
              ? 'system-ui, -apple-system, "Segoe UI", sans-serif'
              : '"PingFang TC","Microsoft JhengHei",sans-serif',
          margin: 0,
          background: "#f3f6f9",
          color: "#0f172a",
        }}
      >
        <div style={{ maxWidth: 420, margin: "80px auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>{t("error.globalTitle")}</h1>
          <p style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>
            {error?.message?.slice(0, 120) || t("error.globalBody")}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: 44,
              padding: "10px 18px",
              borderRadius: 12,
              border: "none",
              background: "#07111f",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {t("error.retry")}
          </button>
        </div>
      </body>
    </html>
  );
}
