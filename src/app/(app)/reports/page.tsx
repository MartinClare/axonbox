"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  Shield,
  BadgeCheck,
  Sparkles,
  FileType,
  Loader2,
  CalendarRange,
  CalendarDays,
  ClipboardCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useI18n } from "@/components/I18nProvider";

type GenKind =
  | "daily"
  | "weekly"
  | "monthly"
  | "acceptance"
  | "events"
  | "safety"
  | "quality";

const CARD_META: Array<{
  kind: GenKind;
  titleKey: string;
  descKey: string;
  icon: typeof FileText;
}> = [
  { kind: "daily", titleKey: "reports.daily", descKey: "reports.dailyDesc", icon: Sparkles },
  { kind: "weekly", titleKey: "reports.weekly", descKey: "reports.weeklyDesc", icon: CalendarRange },
  { kind: "monthly", titleKey: "reports.monthly", descKey: "reports.monthlyDesc", icon: CalendarDays },
  {
    kind: "acceptance",
    titleKey: "reports.acceptance",
    descKey: "reports.acceptanceDesc",
    icon: ClipboardCheck,
  },
  { kind: "events", titleKey: "reports.events", descKey: "reports.eventsDesc", icon: FileText },
  { kind: "safety", titleKey: "reports.safety", descKey: "reports.safetyDesc", icon: Shield },
  { kind: "quality", titleKey: "reports.quality", descKey: "reports.qualityDesc", icon: BadgeCheck },
];

export default function ReportsPage() {
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<
    Array<{ format: string; filePath: string; title?: string }>
  >([]);
  const [summary, setSummary] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const cards = useMemo(
    () =>
      CARD_META.map((c) => ({
        ...c,
        title: t(c.titleKey),
        desc: t(c.descKey),
      })),
    [t],
  );

  async function oneClick(kind: GenKind) {
    setBusy(kind);
    setSummary("");
    const res = await apiFetch<{
      exports?: Array<{ format: string; filePath: string; title?: string }>;
      narrative?: string;
      summary?: string;
      message?: string;
      error?: string;
    }>("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        date,
        formats: ["docx", "pdf"],
      }),
    });
    setBusy(null);
    if (!res.ok) {
      setSummary(res.error || t("reports.fail"));
      return;
    }
    setLast(res.data?.exports || []);
    setSummary(
      res.data?.narrative || res.data?.summary || res.data?.message || t("reports.ok"),
    );
    if (res.data?.exports?.[0]?.filePath) {
      window.open(res.data.exports[0].filePath, "_blank");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="axon-title text-2xl font-semibold">{t("reports.title")}</h1>
          <p className="mt-1 text-sm axon-muted">{t("reports.subtitle")}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          {t("reports.baseDate")}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="axon-input w-auto"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.kind} className="axon-panel flex flex-col p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--axon-sand)] text-[var(--axon-blue)]">
                <Icon size={18} />
              </div>
              <h2 className="font-semibold text-[var(--axon-ink)]">{r.title}</h2>
              <p className="mt-1 flex-1 text-sm text-slate-500">{r.desc}</p>
              <button
                disabled={busy === r.kind}
                onClick={() => oneClick(r.kind)}
                className="axon-btn axon-btn-primary mt-4 w-full"
              >
                {busy === r.kind ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <FileType size={14} />
                )}
                {busy === r.kind ? t("reports.generating") : t("reports.generate")}
              </button>
            </div>
          );
        })}
      </div>

      {(summary || last.length > 0) && (
        <section className="axon-panel space-y-3 p-5">
          <h2 className="text-sm font-semibold text-[var(--axon-ink)]">{t("reports.recent")}</h2>
          {summary && <p className="text-sm leading-relaxed text-slate-700">{summary}</p>}
          <ul className="space-y-2">
            {last.map((f) => (
              <li key={f.filePath}>
                <a
                  href={f.filePath}
                  target="_blank"
                  className="text-sm text-[var(--axon-blue)] hover:underline"
                >
                  [{f.format}] {f.title || f.filePath}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
