"use client";

import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/components/I18nProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import type { UiLocale } from "@/lib/i18n/types";

export function ClientProviders({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: UiLocale;
}) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <I18nProvider initialLocale={initialLocale}>{children}</I18nProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
