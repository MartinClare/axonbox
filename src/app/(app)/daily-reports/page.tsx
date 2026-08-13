"use client";

import { useEffect, useState } from "react";
import { KpiCard } from "@/components/KpiCard";
import { CASE_STATUS_LABELS, SEVERITY_LABELS, STATUS_COLORS, cn, formatDay } from "@/lib/labels";
import { apiFetch, safeJsonParse } from "@/lib/api-client";

type Report = {
  id: string;
  date: string;
  weather: string | null;
  workerCount: number;
  subcontractorCount: number;
  progressPct: number;
  safetyEvents: number;
  activitiesJson: string;
  tomorrowPlanJson: string;
  issuesJson: string;
  status: string;
  exports?: Array<{ id: string; filePath: string; title: string | null }>;
};

export default function DailyReportsPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const res = await apiFetch<Report | null>(`/api/daily-reports?date=${date}`);
    if (!res.ok) {
      setReport(null);
      setMsg(res.error);
      return;
    }
    // API may return null when no report
    const data = res.data;
    setReport(data && typeof data === "object" && "id" in data ? data : null);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function generate() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/daily-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate", date }),
    });
    setBusy(false);
    if (res.ok) {
      setReport(await res.json());
      setMsg("已從當日事件／證據產生草稿");
    }
  }

  async function oneClick() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/reports/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "daily", date, formats: ["docx", "pdf"] }),
    });
    setBusy(false);
    const data = await res.json();
    if (res.ok) {
      setMsg(data.narrative || "已一鍵產生 Word + PDF");
      if (data.exports?.[0]?.filePath) window.open(data.exports[0].filePath, "_blank");
      await load();
    } else {
      setMsg(data.error || "產生失敗");
    }
  }

  async function exportReport() {
    if (!report) return;
    setBusy(true);
    const res = await fetch("/api/daily-reports", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: report.id, formats: ["docx", "pdf"] }),
    });
    setBusy(false);
    const data = await res.json();
    if (data.filePath) {
      setMsg("已匯出 Word／PDF");
      window.open(data.filePath, "_blank");
      await load();
    }
  }

  const activities = report
    ? safeJsonParse<Array<{ time: string; name: string; status: string }>>(
        report.activitiesJson,
        [],
      )
    : [];
  const issues = report
    ? safeJsonParse<
        Array<{ id: string; issue: string; risk: string; assignee: string; status: string }>
      >(report.issuesJson, [])
    : [];
  const plans = report ? safeJsonParse<string[]>(report.tomorrowPlanJson, []) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="axon-title text-2xl font-semibold">日報管理</h1>
          <p className="text-sm axon-muted">選日期 → 一鍵出報</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="axon-input w-auto"
          />
          <button disabled={busy} onClick={oneClick} className="axon-btn axon-btn-primary">
            一鍵 Word＋PDF
          </button>
          <button disabled={busy} onClick={generate} className="axon-btn axon-btn-ghost">
            僅草稿
          </button>
          <button
            disabled={busy || !report}
            onClick={exportReport}
            className="axon-btn axon-btn-ghost"
          >
            匯出草稿
          </button>
        </div>
      </div>
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}

      {!report ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          此日期尚無日報。點「一鍵 Word＋PDF」即可自動彙整並出報告。
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard label="天氣" value={report.weather || "—"} />
            <KpiCard label="工人數" value={report.workerCount} />
            <KpiCard label="分判商" value={report.subcontractorCount} />
            <KpiCard label="安全事件" value={report.safetyEvents} />
            <KpiCard label="進度完成" value={`${report.progressPct}%`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold">主要活動時間線 · {formatDay(report.date)}</h2>
              <ol className="space-y-3 border-l border-slate-200 pl-4">
                {activities.map((a: { time: string; name: string; status: string }, i: number) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[1.15rem] top-1.5 h-2 w-2 rounded-full bg-[var(--axon-blue)]" />
                    <div className="text-xs text-slate-400">{a.time}</div>
                    <div className="text-sm font-medium">{a.name}</div>
                    <span
                      className={cn(
                        "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px]",
                        a.status === "完成" ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700"
                      )}
                    >
                      {a.status}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-xl border bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold">問題與跟進</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th className="py-2">問題</th>
                      <th>風險</th>
                      <th>負責人</th>
                      <th>狀態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.map((i: { id: string; issue: string; risk: string; assignee: string; status: string }) => (
                      <tr key={i.id} className="border-t">
                        <td className="py-2 pr-2">
                          <div className="font-medium">{i.issue}</div>
                          <div className="text-xs text-slate-400">{i.id}</div>
                        </td>
                        <td>{SEVERITY_LABELS[i.risk] || i.risk}</td>
                        <td>{i.assignee}</td>
                        <td>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px]", STATUS_COLORS[i.status])}>
                            {CASE_STATUS_LABELS[i.status] || i.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 className="mb-2 mt-6 text-sm font-semibold">明日計劃</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {plans.map((p: string, idx: number) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
              {report.exports && report.exports.length > 0 && (
                <div className="mt-4 border-t pt-3">
                  <div className="text-xs font-semibold text-slate-500">已匯出</div>
                  {report.exports.map((e) => (
                    <a key={e.id} href={e.filePath} target="_blank" className="mt-1 block text-sm text-[var(--axon-blue)]">
                      {e.title || e.filePath}
                    </a>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
