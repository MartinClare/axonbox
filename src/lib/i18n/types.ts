export type UiLocale = "zh-Hant" | "en";

export const UI_LOCALE_COOKIE = "axonbox-ui-locale";
export const UI_LOCALE_STORAGE_KEY = "axonbox:uiLocale";
export const DEFAULT_UI_LOCALE: UiLocale = "zh-Hant";

export function normalizeUiLocale(v: unknown): UiLocale {
  return v === "en" ? "en" : "zh-Hant";
}

export const UI_LOCALE_OPTIONS: Array<{ id: UiLocale; label: string; native: string }> = [
  { id: "zh-Hant", label: "Traditional Chinese", native: "繁體中文" },
  { id: "en", label: "English", native: "English" },
];
