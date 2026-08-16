import { cookies } from "next/headers";
import { ClientProviders } from "@/components/ClientProviders";
import {
  DEFAULT_UI_LOCALE,
  normalizeUiLocale,
  UI_LOCALE_COOKIE,
} from "@/lib/i18n/types";

export async function Providers({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const initialLocale = normalizeUiLocale(jar.get(UI_LOCALE_COOKIE)?.value) || DEFAULT_UI_LOCALE;
  return <ClientProviders initialLocale={initialLocale}>{children}</ClientProviders>;
}
