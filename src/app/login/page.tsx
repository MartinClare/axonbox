"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  APP_DEMO_EMAIL,
  APP_DEMO_PASSWORD,
  APP_NAME,
} from "@/lib/brand";
import { useI18n } from "@/components/I18nProvider";

export default function LoginPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState(APP_DEMO_EMAIL);
  const [password, setPassword] = useState(APP_DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [callbackUrl, setCallbackUrl] = useState("/");
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("reason") === "stale") {
      setError(t("login.err.stale"));
    }
    const cb = sp.get("callbackUrl");
    if (cb && cb.startsWith("/")) setCallbackUrl(cb);

    let cancelled = false;
    async function ping() {
      try {
        const res = await fetch(`/api/health?t=${Date.now()}`, { cache: "no-store" });
        if (!cancelled) setServerOk(res.ok);
      } catch {
        if (!cancelled) setServerOk(false);
      }
    }
    ping();
    const id = setInterval(ping, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [t]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await fetch(`/api/health?t=${Date.now()}`, { cache: "no-store" }).catch(() => null);
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error || !res?.ok) {
        setError(t("login.err.fail"));
        return;
      }
      window.location.assign(callbackUrl || "/");
    } catch {
      setError(t("login.err.offline"));
      setServerOk(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--axon-ink)] px-4 py-10">
      {/* Engineering atmosphere */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(#FECE32 1px, transparent 1px), linear-gradient(90deg, #FECE32 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[var(--axon-accent)]/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-[var(--axon-danger)]/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--axon-danger)] via-[var(--axon-accent)] to-[var(--axon-signal)]" />

      <div className="relative w-full max-w-[420px]">
        <div className="mb-6 text-center md:mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt={APP_NAME}
            className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover shadow-lg ring-2 ring-[var(--axon-signal)]"
          />
          <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            {APP_NAME}
          </h1>
          <p className="mt-2 text-sm text-white/60">{t("meta.tagline")}</p>
          <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--axon-signal)]">
            {t("login.badge")}
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[var(--axon-line)] bg-[var(--axon-cream)] shadow-2xl shadow-black/30">
          <div className="h-1.5 bg-gradient-to-r from-[var(--axon-danger)] via-[var(--axon-accent)] to-[var(--axon-signal)]" />
          <form onSubmit={onSubmit} className="space-y-4 p-6 sm:p-8">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--axon-ink)]/70">
                {t("login.email")}
              </label>
              <input
                className="axon-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[var(--axon-ink)]/70">
                {t("login.password")}
              </label>
              <input
                className="axon-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            {serverOk === false && (
              <p className="rounded-xl border border-[var(--axon-accent)]/30 bg-[var(--axon-signal)]/25 px-3 py-2 text-xs text-[var(--axon-ink)]">
                {t("login.serverDown")}{" "}
                <code className="rounded bg-white/70 px-1">npm run start:daemon</code>
              </p>
            )}
            {error && <p className="text-sm font-medium text-[var(--axon-danger)]">{error}</p>}
            <button
              disabled={loading || serverOk === false}
              className="axon-btn axon-btn-accent w-full"
            >
              {loading ? t("login.submitting") : t("login.submit")}
            </button>
          </form>
          <div className="border-t border-[var(--axon-line)] bg-[var(--axon-sand)]/60 px-6 py-4 text-center sm:px-8">
            <p className="text-xs text-[var(--axon-ink)]/45">
              {APP_DEMO_EMAIL} / {APP_DEMO_PASSWORD}
            </p>
            <p className="mt-2 break-all text-xs text-[var(--axon-ink)]/55">
              {t("login.openAt")}{" "}
              <span className="font-semibold text-[var(--axon-ink)]">{origin}</span>
            </p>
            <div className="mt-3 flex justify-center gap-4 text-xs font-semibold">
              <Link href="/install" className="text-[var(--axon-accent)] hover:underline">
                {t("login.installApp")}
              </Link>
              <Link href="/open" className="text-[var(--axon-ink)] hover:underline">
                {t("login.openGuide")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
