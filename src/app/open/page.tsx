"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Copy, Check, Monitor, Smartphone, Wifi, Globe } from "lucide-react";
import { APP_DEMO_EMAIL, APP_DEMO_PASSWORD, APP_NAME } from "@/lib/brand";
import { useI18n } from "@/components/I18nProvider";

export default function OpenPage() {
  const { t } = useI18n();
  const [origin, setOrigin] = useState("");
  const [lanHint, setLanHint] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const o = window.location.origin;
    setOrigin(o);
    if (o.includes("localhost") || o.includes("127.0.0.1")) {
      setLanHint(t("open.lanHint.local"));
    } else {
      setLanHint(t("open.lanHint.shared"));
    }
  }, [t]);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-8">
      <div>
        <h1 className="axon-title text-2xl font-semibold">{t("open.title", { name: APP_NAME })}</h1>
        <p className="mt-1 text-sm axon-muted">{t("open.subtitle")}</p>
      </div>

      <section className="axon-panel space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Globe size={15} />
          {t("open.currentUrl")}
        </h2>
        <p className="break-all rounded-xl bg-[var(--axon-sand)] px-3 py-3 text-sm font-medium text-[var(--axon-ink)]">
          {origin || "…"}
        </p>
        <button
          type="button"
          className="axon-btn axon-btn-primary w-full"
          onClick={() => copy(origin, "origin")}
          disabled={!origin}
        >
          {copied === "origin" ? <Check size={15} /> : <Copy size={15} />}
          {copied === "origin" ? t("open.copied") : t("open.copyUrl")}
        </button>
        <p className="text-xs text-slate-500">{lanHint}</p>
      </section>

      <section className="axon-panel space-y-2 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Monitor size={15} />
          {t("open.desktopTitle")}
        </h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>{t("open.desktop.1")}</li>
          <li>{t("open.desktop.2")}</li>
          <li>{t("open.desktop.3")}</li>
        </ol>
      </section>

      <section className="axon-panel space-y-2 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Smartphone size={15} />
          {t("open.mobileTitle")}
        </h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>{t("open.mobile.1")}</li>
          <li>{t("open.mobile.2")}</li>
          <li>{t("open.mobile.3")}</li>
        </ol>
      </section>

      <section className="axon-panel space-y-2 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Wifi size={15} />
          {t("open.pwaTitle", { name: APP_NAME })}
        </h2>
        <p className="text-sm text-slate-700">{t("open.pwaBody", { name: APP_NAME })}</p>
        <Link href="/install" className="axon-btn axon-btn-ok w-full">
          {t("open.pwaCta", { name: APP_NAME })}
        </Link>
      </section>

      <section className="axon-panel p-5 text-sm text-slate-600">
        <div className="font-medium text-[var(--axon-ink)]">{t("open.demoAccount")}</div>
        <p className="mt-1">
          {APP_DEMO_EMAIL}／{APP_DEMO_PASSWORD}
        </p>
        <Link href="/login" className="mt-3 inline-flex text-[var(--axon-blue)]">
          {t("open.goLogin")}
        </Link>
      </section>
    </div>
  );
}
