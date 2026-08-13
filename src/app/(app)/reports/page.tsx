"use client";

import { useState } from "react";
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

type GenKind =
  | "daily"
  | "weekly"
  | "monthly"
  | "acceptance"
  | "events"
  | "safety"
  | "quality";

const CARDS: Array<{
  kind: GenKind;
  title: string;
  desc: string;
  icon: typeof FileText;
}> = [
  {
    kind: "daily",
    title: "日報",
    desc: "當日事件／證據一鍵彙整 Word＋PDF",
    icon: Sparkles,
  },
  {
    kind: "weekly",
    title: "週報",
    desc: "本週事件窗口彙整（週一至週日）",
    icon: CalendarRange,
  },
  {
    kind: "monthly",
    title: "月報",
    desc: "當月工程管理總結",
    icon: CalendarDays,
  },
  {
    kind: "acceptance",
    title: "驗收報告",
    desc: "已關閉事項＋證據索引，供階段／竣工驗收",
    icon: ClipboardCheck,
  },
  {
    kind: "events",
    title: "事件總覽",
    desc: "全部事件清單",
    icon: FileText,
  },
  {
    kind: "safety",
    title: "安全專報",
    desc: "安全類事件精準彙整",
    icon: Shield,
  },
  {
    kind: "quality",
    title: "質量匯總",
    desc: "質量類事件精準彙整",
    icon: BadgeCheck,
  },
];

export default function ReportsPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<
    Array<{ format: string; filePath: string; title?: string }>
  >([]);
  const [summary, setSummary] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

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
      setSummary(res.error || "產生失敗");
      return;
    }
    setLast(res.data?.exports || []);
    setSummary(res.data?.narrative || res.data?.summary || res.data?.message || "已產生");
    if (res.data?.exports?.[0]?.filePath) {
      window.open(res.data.exports[0].filePath, "_blank");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="axon-title text-2xl font-semibold">報表中心</h1>
          <p className="mt-1 text-sm axon-muted">日報 · 週報 · 月報 · 驗收 · 一鍵 Word／PDF</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          基準日期
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="axon-input w-auto"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((r) => {
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
                {busy === r.kind ? "產生中…" : "產生報告"}
              </button>
            </div>
          );
        })}
      </div>

      {(summary || last.length > 0) && (
        <section className="axon-panel space-y-3 p-5">
          <h2 className="text-sm font-semibold text-[var(--axon-ink)]">最近產生</h2>
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
