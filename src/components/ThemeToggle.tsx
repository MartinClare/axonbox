"use client";

import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/components/I18nProvider";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/labels";

type Props = {
  className?: string;
  /** Compact icon button for sidebar / mobile chrome */
  compact?: boolean;
};

export function ThemeToggle({ className, compact }: Props) {
  const { t } = useI18n();
  const { resolved, toggleLightDark } = useTheme();
  const isDark = resolved === "dark";

  if (compact) {
    return (
      <button
        type="button"
        onClick={toggleLightDark}
        aria-label={t("settings.themeToggle")}
        title={t("settings.themeToggle")}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white",
          className,
        )}
      >
        {isDark ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleLightDark}
      aria-label={t("settings.themeToggle")}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-[var(--axon-line)] bg-[var(--axon-panel)] px-3 py-2 text-sm text-[var(--axon-ink)] transition hover:border-[var(--axon-accent)]",
        className,
      )}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
      {isDark ? t("settings.themeLight") : t("settings.themeDark")}
    </button>
  );
}
