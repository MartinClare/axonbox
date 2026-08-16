"use client";

import Link from "next/link";
import { useI18n } from "@/components/I18nProvider";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
      <h1 className="axon-title text-xl font-semibold">{t("error.appTitle")}</h1>
      <p className="text-sm axon-muted">
        {error?.message?.slice(0, 160) || t("error.appBody")}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className="axon-btn axon-btn-primary">
          {t("error.retry")}
        </button>
        <Link href="/" className="axon-btn axon-btn-ghost">
          {t("error.home")}
        </Link>
        <Link href="/login" className="axon-btn axon-btn-ghost">
          {t("error.login")}
        </Link>
      </div>
    </div>
  );
}
