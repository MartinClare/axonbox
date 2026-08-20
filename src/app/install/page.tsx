"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Share,
  MoreVertical,
  Plus,
  Smartphone,
  Monitor,
  Wifi,
  CheckCircle2,
} from "lucide-react";
import { APP_DEMO_EMAIL, APP_DEMO_PASSWORD, APP_NAME } from "@/lib/brand";
import { useI18n } from "@/components/I18nProvider";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPage() {
  const { t } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [done, setDone] = useState(false);
  const [origin, setOrigin] = useState("");
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    );
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setDone(true);
    setDeferred(null);
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-8 pb-16">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt={APP_NAME}
            className="mx-auto h-20 w-20 rounded-[22px] shadow-md"
          />
          <h1 className="axon-title mt-4 text-2xl font-semibold">
            {t("install.title", { name: APP_NAME })}
          </h1>
          <p className="axon-muted mt-2 text-sm leading-relaxed">{t("meta.tagline")}</p>
          <p className="mt-1 text-xs text-slate-400">{t("install.subtitle")}</p>
        </div>

        {standalone && (
          <div className="axon-panel flex items-center gap-2 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 size={16} />
            {t("install.standalone", { name: APP_NAME })}
          </div>
        )}

        <section className="axon-panel space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--axon-ink)]">
            <Smartphone size={15} />
            {t("install.androidOneTap")}
          </h2>
          {done ? (
            <p className="text-sm text-emerald-700">{t("install.done", { name: APP_NAME })}</p>
          ) : deferred ? (
            <button onClick={install} className="axon-btn axon-btn-primary w-full">
              <Smartphone size={16} />
              {t("install.cta", { name: APP_NAME })}
            </button>
          ) : (
            <p className="text-sm text-slate-600">{t("install.noPrompt")}</p>
          )}
          {origin && (
            <p className="break-all rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
              {t("install.url", { origin })}
            </p>
          )}
        </section>

        <section className="axon-panel space-y-4 p-5">
          <h2 className="text-sm font-semibold text-[var(--axon-ink)]">{t("install.iosTitle")}</h2>
          <ol className="space-y-3 text-sm text-slate-700">
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <Share size={14} />
              </span>
              <span className="pt-1">{t("install.ios.1")}</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <Plus size={14} />
              </span>
              <span className="pt-1">{t("install.ios.2")}</span>
            </li>
            <li className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/icon-192.png"
                alt=""
                className="h-8 w-8 shrink-0 rounded-lg object-cover"
              />
              <span className="pt-1">{t("install.ios.3", { name: APP_NAME })}</span>
            </li>
          </ol>
        </section>

        <section className="axon-panel space-y-4 p-5">
          <h2 className="text-sm font-semibold text-[var(--axon-ink)]">{t("install.androidManual")}</h2>
          <ol className="space-y-3 text-sm text-slate-700">
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <MoreVertical size={14} />
              </span>
              <span className="pt-1">{t("install.android.1")}</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <Plus size={14} />
              </span>
              <span className="pt-1">{t("install.android.2")}</span>
            </li>
          </ol>
        </section>

        <section className="axon-panel space-y-3 p-5 text-sm text-slate-600">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--axon-ink)]">
            <Monitor size={15} />
            {t("install.desktopTitle")}
          </h2>
          <p>{t("install.desktopBody")}</p>
          <p className="text-xs text-slate-400">
            {t("install.account")} {APP_DEMO_EMAIL}／{APP_DEMO_PASSWORD}
          </p>
          <Link href="/open" className="axon-btn axon-btn-ghost w-full">
            <Wifi size={15} />
            {t("install.openGuide")}
          </Link>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <Link href="/login" className="axon-btn axon-btn-primary">
            {t("install.login")}
          </Link>
          <Link href="/m/capture" className="axon-btn axon-btn-ghost">
            {t("install.goCapture")}
          </Link>
        </div>
      </div>
    </div>
  );
}
