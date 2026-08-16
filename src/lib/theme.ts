export const THEME_STORAGE_KEY = "axon-theme";
export const THEME_COOKIE = "axon_theme";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_OPTIONS: Array<{ id: ThemePreference; labelKey: string }> = [
  { id: "light", labelKey: "settings.themeLight" },
  { id: "dark", labelKey: "settings.themeDark" },
  { id: "system", labelKey: "settings.themeSystem" },
];

export function normalizeTheme(value: string | null | undefined): ThemePreference {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemDark = false,
): ResolvedTheme {
  if (preference === "system") return systemDark ? "dark" : "light";
  return preference;
}

export function applyResolvedTheme(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  root.dataset.theme = resolved;
}

/** Inline boot script — keeps FOUC down before React hydrates. */
export const THEME_BOOT_SCRIPT = `(()=>{try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var v=localStorage.getItem(k)||"system";var d=v==="dark"||(v!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";r.dataset.theme=d?"dark":"light";}catch(e){}})();`;
