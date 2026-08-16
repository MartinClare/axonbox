"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useI18n } from "@/components/I18nProvider";
import { UI_LOCALE_OPTIONS, type UiLocale } from "@/lib/i18n/types";
import { cn } from "@/lib/labels";

type SettingsData = {
  project: {
    id: string;
    name: string;
    siteCode: string;
    address: string | null;
    weather: string | null;
  } | null;
  users: Array<{ id: string; name: string; email: string; role: string }>;
  subcontractors: Array<{
    id: string;
    name: string;
    contact: string | null;
    trade?: string | null;
  }>;
  aiConfigured: boolean;
  aiModel?: string | null;
  aiProvider?: string | null;
};

type OrgInfo = {
  org: {
    name: string;
    plan: string;
    allowSubInvite: boolean;
    requireApproval: boolean;
  };
  myRole: string;
  myPermissions: string[];
  roleLabels: Record<string, string>;
};

export default function SettingsPage() {
  const { t, locale, setLocale, roleLabels } = useI18n();
  const [data, setData] = useState<SettingsData | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [form, setForm] = useState({ name: "", siteCode: "", address: "", weather: "" });
  const [msg, setMsg] = useState("");
  const [more, setMore] = useState(false);

  useEffect(() => {
    apiFetch<SettingsData>("/api/settings").then((res) => {
      if (!res.ok || !res.data) return;
      setData(res.data);
      if (res.data.project) {
        setForm({
          name: res.data.project.name,
          siteCode: res.data.project.siteCode,
          address: res.data.project.address || "",
          weather: res.data.project.weather || "",
        });
      }
    });
    apiFetch<OrgInfo>("/api/org").then((res) => {
      if (res.ok && res.data) setOrg(res.data);
    });
  }, []);

  async function save() {
    if (!data?.project) return;
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: data.project.id, ...form }),
    });
    if (res.ok) setMsg(t("common.saved"));
  }

  if (!data) return <div className="text-sm text-slate-500">{t("common.loading")}</div>;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="axon-title text-2xl font-semibold">{t("settings.title")}</h1>
        <p className="mt-1 text-sm axon-muted">{t("settings.subtitle")}</p>
      </div>

      <section className="axon-panel space-y-3 p-5">
        <h2 className="text-sm font-semibold text-[var(--axon-ink)]">{t("settings.language")}</h2>
        <p className="text-xs text-slate-500">{t("settings.languageHint")}</p>
        <div className="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-[var(--axon-line)]">
          {UI_LOCALE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setLocale(opt.id as UiLocale)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition",
                locale === opt.id
                  ? "bg-white text-[var(--axon-ink)] shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {opt.native}
            </button>
          ))}
        </div>
      </section>

      <section className="axon-panel space-y-3 p-5">
        <h2 className="text-sm font-semibold text-[var(--axon-ink)]">{t("settings.project")}</h2>
        <input
          className="axon-input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={t("settings.projectName")}
        />
        <input
          className="axon-input"
          value={form.siteCode}
          onChange={(e) => setForm({ ...form, siteCode: e.target.value })}
          placeholder={t("settings.siteCode")}
        />
        {more && (
          <>
            <input
              className="axon-input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder={t("settings.address")}
            />
            <input
              className="axon-input"
              value={form.weather}
              onChange={(e) => setForm({ ...form, weather: e.target.value })}
              placeholder={t("settings.weather")}
            />
          </>
        )}
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          className="text-sm text-[var(--axon-blue)]"
        >
          {more ? t("settings.lessFields") : t("settings.moreFields")}
        </button>
        <button onClick={save} className="axon-btn axon-btn-primary w-full">
          {t("common.save")}
        </button>
        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      </section>

      {org && (
        <section className="axon-panel space-y-3 p-5">
          <h2 className="text-sm font-semibold text-[var(--axon-ink)]">{t("settings.org")}</h2>
          <p className="text-sm text-slate-600">
            {t("settings.orgLine", { name: org.org.name, plan: org.org.plan })}
          </p>
          <p className="text-sm">
            {t("settings.myRole")}
            <span className="font-medium text-[var(--axon-ink)]">
              {roleLabels[org.myRole] || org.roleLabels[org.myRole] || org.myRole}
            </span>
          </p>
          <p className="text-xs text-slate-500">{t("settings.roleHint")}</p>
          <div className="flex flex-wrap gap-1">
            {org.myPermissions.slice(0, 8).map((p) => (
              <span key={p} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                {p}
              </span>
            ))}
            {org.myPermissions.length > 8 && (
              <span className="text-[10px] text-slate-400">+{org.myPermissions.length - 8}</span>
            )}
          </div>
          <Link href="/directory" className="text-sm text-[var(--axon-blue)]">
            {t("settings.manageRoles")}
          </Link>
        </section>
      )}

      <section className="axon-panel space-y-2 p-5">
        <h2 className="text-sm font-semibold text-[var(--axon-ink)]">{t("settings.ai")}</h2>
        <p className="text-sm">
          <span className={data.aiConfigured ? "text-emerald-600" : "text-amber-600"}>
            {data.aiConfigured
              ? t("settings.aiOn", {
                  provider: data.aiProvider || "api",
                  model: data.aiModel || "model",
                })
              : t("settings.aiOff")}
          </span>
        </p>
        <p className="text-xs text-slate-400">{t("settings.aiHint")}</p>
      </section>

      <section className="axon-panel p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--axon-ink)]">{t("settings.people")}</h2>
          <Link
            href="/directory"
            className="inline-flex items-center gap-1 text-sm text-[var(--axon-blue)]"
          >
            {t("settings.goDirectory")}
            <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="text-2xl font-semibold text-[var(--axon-ink)]">{data.users.length}</div>
            <div className="text-xs text-slate-500">{t("settings.userAccounts")}</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="text-2xl font-semibold text-[var(--axon-ink)]">
              {data.subcontractors.length}
            </div>
            <div className="text-xs text-slate-500">{t("settings.subCompanies")}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
