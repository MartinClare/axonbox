"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_UI_LOCALE,
  normalizeUiLocale,
  UI_LOCALE_COOKIE,
  UI_LOCALE_STORAGE_KEY,
  type UiLocale,
} from "@/lib/i18n/types";
import { translate, domainLabelMap } from "@/lib/i18n/messages";

type I18nContextValue = {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  categoryLabels: Record<string, string>;
  severityLabels: Record<string, string>;
  caseStatusLabels: Record<string, string>;
  taskStatusLabels: Record<string, string>;
  evidenceStatusLabels: Record<string, string>;
  channelLabels: Record<string, string>;
  inboxStatusLabels: Record<string, string>;
  roleLabels: Record<string, string>;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): UiLocale {
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

function persistLocale(locale: UiLocale) {
  try {
    window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, locale);
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${UI_LOCALE_COOKIE}=${encodeURIComponent(locale)}; path=/; max-age=${maxAge}; samesite=lax`;
    document.documentElement.lang = locale === "en" ? "en" : "zh-Hant";
  } catch {
    /* ignore */
  }
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: ReactNode;
  initialLocale?: UiLocale;
}) {
  const [locale, setLocaleState] = useState<UiLocale>(initialLocale || DEFAULT_UI_LOCALE);

  useEffect(() => {
    const stored = readStoredLocale();
    setLocaleState(stored);
    persistLocale(stored);
  }, []);

  const setLocale = useCallback((next: UiLocale) => {
    const normalized = normalizeUiLocale(next);
    setLocaleState(normalized);
    persistLocale(normalized);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      setLocale,
      t,
      categoryLabels: domainLabelMap(locale, "label.category", [
        "SAFETY",
        "QUALITY",
        "PROGRESS",
        "ENVIRONMENT",
        "OTHER",
      ]),
      severityLabels: domainLabelMap(locale, "label.severity", ["HIGH", "MEDIUM", "LOW"]),
      caseStatusLabels: domainLabelMap(locale, "label.case", [
        "OPEN",
        "ASSIGNED",
        "IN_PROGRESS",
        "PENDING_REVIEW",
        "CLOSED",
      ]),
      taskStatusLabels: domainLabelMap(locale, "label.task", [
        "PENDING",
        "IN_PROGRESS",
        "PENDING_REVIEW",
        "DONE",
      ]),
      evidenceStatusLabels: domainLabelMap(locale, "label.evidence", [
        "PENDING",
        "IN_PROGRESS",
        "HANDLED",
      ]),
      channelLabels: domainLabelMap(locale, "label.channel", [
        "EMAIL",
        "WHATSAPP",
        "WECHAT",
        "MANUAL",
      ]),
      inboxStatusLabels: domainLabelMap(locale, "label.inbox", [
        "PENDING",
        "ANALYZED",
        "PROCESSED",
        "DISMISSED",
      ]),
      roleLabels: domainLabelMap(locale, "label.role", [
        "OWNER",
        "ADMIN",
        "SUPERVISOR",
        "VIEWER",
        "SUBCONTRACTOR",
      ]),
    };
  }, [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}
