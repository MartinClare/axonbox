"use client";

import { useEffect, useState } from "react";
import { KpiCard } from "@/components/KpiCard";
import { STATUS_COLORS, cn, formatDay } from "@/lib/labels";
import { apiFetch, safeJsonParse } from "@/lib/api-client";
import { useI18n } from "@/components/I18nProvider";

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

type DiaryRollup = {
  date: string;
  opened: number;
  closed: number;
  overdue: number;
  openSafety: number;
  photos: Array<{ id: string; title: string; href: string | null; caseId: string | null }>;
  shareText: string;
};

function isRemarksPlanLine(p: string) {
  return p.startsWith("備註：") || p.startsWith("Notes:");
}

function stripRemarksPrefix(p: string) {
  return p.replace(/^(備註：|Notes:)\s*/, "");
}

export default function DailyReportsPage() {
  const { t, caseStatusLabels, severityLabels } = useI18n();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<Report | null>(null);
  const [diary, setDiary] = useState<DiaryRollup | null>(null);
  const [weather, setWeather] = useState("");
  const [workers, setWorkers] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function load() {
    const [res, diaryRes] = await Promise.all([
      apiFetch<Report | null>(`/api/daily-reports?date=${date}`),
      apiFetch<DiaryRollup>(`/api/site-diary?date=${date}`),
    ]);
    if (!res.ok) {
      setReport(null);
      setMsg(res.error);
    } else {
      const data = res.data;
      const r = data && typeof data === "object" && "id" in data ? data : null;
      setReport(r);
      if (r) {
        setWeather(r.weather || "");
        setWorkers(String(r.workerCount ?? ""));
      }
    }
    if (diaryRes.ok && diaryRes.data) setDiary(diaryRes.data);
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
      body: JSON.stringify({
        action: "generate",
        date,
        weather: weather || undefined,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setReport(await res.json());
      setMsg(t("diary.draftOk"));
      await load();
    }
  }

  async function saveMeta() {
    if (!report) return;
    setBusy(true);
    const plans = safeJsonParse<string[]>(report.tomorrowPlanJson, []).filter(
      (p) => !isRemarksPlanLine(p),
    );
    if (remarks.trim()) plans.unshift(`${t("diary.remarksPrefix")}${remarks.trim()}`);
    const res = await fetch("/api/daily-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        id: report.id,
        weather: weather || report.weather,
        workerCount: Number(workers) || report.workerCount,
        tomorrowPlanJson: JSON.stringify(plans),
      }),
    });
    setBusy(false);
    if (res.ok) {
      setMsg(t("diary.savedMeta"));
      await load();
    } else {
      setMsg(t("diary.saveFail"));
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
      setMsg(data.narrative || t("diary.genOk"));
      if (data.exports?.[0]?.filePath) window.open(data.exports[0].filePath, "_blank");
      await load();
    } else {
      setMsg(data.error || t("diary.genFail"));
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
      setMsg(t("diary.exportOk"));
      window.open(data.filePath, "_blank");
      await load();
    }
  }

  async function copyShare() {
    const base = diary?.shareText || "";
    const extra = [
      weather ? t("diary.shareWeather", { v: weather }) : "",
      workers ? t("diary.shareManpower", { v: workers }) : "",
      remarks ? t("diary.shareNotes", { v: remarks }) : "",
    ]
      .filter(Boolean)
      .join("\n");
    const text = [base, extra].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setMsg(t("diary.copied"));
    } catch {
      setMsg(t("common.copyFail"));
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
  const plans = report
    ? safeJsonParse<string[]>(report.tomorrowPlanJson, []).filter((p) => !isRemarksPlanLine(p))
    : [];

  useEffect(() => {
    if (!report) return;
    const all = safeJsonParse<string[]>(report.tomorrowPlanJson, []);
    const note = all.find((p) => isRemarksPlanLine(p));
    setRemarks(note ? stripRemarksPrefix(note) : "");
  }, [report]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="axon-title text-2xl font-semibold">{t("diary.title")}</h1>
          <p className="text-sm axon-muted">{t("diary.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="axon-input w-auto"
          />
          <button disabled={busy} onClick={copyShare} className="axon-btn axon-btn-ghost">
            {t("diary.copyWa")}
          </button>
          <button disabled={busy} onClick={oneClick} className="axon-btn axon-btn-primary">
            {t("diary.oneClick")}
          </button>
          <button disabled={busy} onClick={generate} className="axon-btn axon-btn-ghost">
            {t("diary.draftOnly")}
          </button>
          <button
            disabled={busy || !report}
            onClick={exportReport}
            className="axon-btn axon-btn-ghost"
          >
            {t("diary.exportDraft")}
          </button>
        </div>
      </div>
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t("diary.opened")} value={diary?.opened ?? t("common.none")} />
        <KpiCard label={t("diary.closed")} value={diary?.closed ?? t("common.none")} />
        <KpiCard label={t("diary.overdue")} value={diary?.overdue ?? t("common.none")} />
        <KpiCard label={t("diary.safetyOpen")} value={diary?.openSafety ?? t("common.none")} />
      </div>

      <section className="axon-panel grid gap-3 p-4 sm:grid-cols-4">
        <label className="text-xs text-slate-500">
          {t("diary.weather")}
          <input
            className="axon-input mt-1"
            value={weather}
            onChange={(e) => setWeather(e.target.value)}
            placeholder={t("diary.weatherPh")}
          />
        </label>
        <label className="text-xs text-slate-500">
          {t("diary.manpower")}
          <input
            className="axon-input mt-1"
            value={workers}
            onChange={(e) => setWorkers(e.target.value)}
            placeholder={t("diary.workersPh")}
          />
        </label>
        <label className="text-xs text-slate-500 sm:col-span-2">
          {t("diary.notes")}
          <input
            className="axon-input mt-1"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder={t("diary.notesPh")}
          />
        </label>
        <button
          type="button"
          disabled={busy || !report}
          onClick={saveMeta}
          className="axon-btn axon-btn-ghost sm:col-span-4 sm:w-fit"
        >
          {t("diary.saveMeta")}
        </button>
      </section>

      {diary && diary.photos.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">{t("diary.photos")}</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {diary.photos.map((p) =>
              p.href ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.id}
                  src={p.href}
                  alt={p.title}
                  className="h-20 w-full rounded-lg object-cover bg-slate-100"
                  title={p.title}
                />
              ) : null,
            )}
          </div>
        </section>
      )}

      {!report ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          {t("diary.emptyDraft")}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <KpiCard label={t("diary.weather")} value={report.weather || t("common.none")} />
            <KpiCard label={t("diary.workerCount")} value={report.workerCount} />
            <KpiCard label={t("diary.subCount")} value={report.subcontractorCount} />
            <KpiCard label={t("diary.safetyEvents")} value={report.safetyEvents} />
            <KpiCard label={t("diary.progress")} value={`${report.progressPct}%`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold">
                {t("diary.timeline", { date: formatDay(report.date) })}
              </h2>
              <ol className="space-y-3 border-l border-slate-200 pl-4">
                {activities.map((a, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[1.15rem] top-1.5 h-2 w-2 rounded-full bg-[var(--axon-blue)]" />
                    <div className="text-xs text-slate-400">{a.time}</div>
                    <div className="text-sm font-medium">{a.name}</div>
                    <span
                      className={cn(
                        "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px]",
                        a.status === "完成" || a.status === "Done"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-sky-100 text-sky-700",
                      )}
                    >
                      {a.status}
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-xl border bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold">{t("diary.issues")}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500">
                    <tr>
                      <th className="py-2">{t("diary.issue")}</th>
                      <th>{t("diary.risk")}</th>
                      <th>{t("common.assignee")}</th>
                      <th>{t("common.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issues.map((i) => (
                      <tr key={i.id} className="border-t">
                        <td className="py-2 pr-2">
                          <div className="font-medium">{i.issue}</div>
                          <div className="text-xs text-slate-400">{i.id}</div>
                        </td>
                        <td>{severityLabels[i.risk] || i.risk}</td>
                        <td>{i.assignee}</td>
                        <td>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px]",
                              STATUS_COLORS[i.status],
                            )}
                          >
                            {caseStatusLabels[i.status] || i.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 className="mb-2 mt-6 text-sm font-semibold">{t("diary.plans")}</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {plans.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
              {report.exports && report.exports.length > 0 && (
                <div className="mt-4 border-t pt-3">
                  <div className="text-xs font-semibold text-slate-500">{t("diary.exported")}</div>
                  {report.exports.map((e) => (
                    <a
                      key={e.id}
                      href={e.filePath}
                      target="_blank"
                      className="mt-1 block text-sm text-[var(--axon-blue)]"
                    >
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
