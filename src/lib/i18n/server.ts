import { cookies } from "next/headers";
import {
  DEFAULT_UI_LOCALE,
  normalizeUiLocale,
  UI_LOCALE_COOKIE,
  type UiLocale,
} from "./types";

export async function getServerUiLocale(): Promise<UiLocale> {
  try {
    const jar = await cookies();
    return normalizeUiLocale(jar.get(UI_LOCALE_COOKIE)?.value) || DEFAULT_UI_LOCALE;
  } catch {
    return DEFAULT_UI_LOCALE;
  }
}
