import { prisma } from "@/lib/prisma";
import { chatText } from "@/lib/ai";
import type { DailyReportPayload, ActivityRow, IssueRow } from "./types";

function dayWindow(dateInput?: string | Date) {
  const day = new Date(dateInput || new Date());
  day.setHours(0, 0, 0, 0);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  return { day, next, dateStr: day.toISOString().slice(0, 10) };
}

/** Aggregate site data into a daily report draft (minimal human input). */
export async function upsertDailyReportDraft(opts: {
  date?: string;
  reporterName?: string;
  weather?: string;
}) {
  const project = await prisma.project.findFirst();
  if (!project) throw new Error("No project");

  const { day, next, dateStr } = dayWindow(opts.date);

  const [cases, evidence, subs] = await Promise.all([
    prisma.case.findMany({
      where: { projectId: project.id, discoveredAt: { gte: day, lt: next } },
      include: { subcontractor: true },
      orderBy: { discoveredAt: "asc" },
    }),
    prisma.evidence.findMany({
      where: {
        projectId: project.id,
        capturedAt: { gte: day, lt: next },
        type: "PHOTO",
      },
      take: 12,
    }),
    prisma.subcontractor.count({ where: { projectId: project.id } }),
  ]);

  // If few same-day events, include open events for a usable engineering report
  const openCases =
    cases.length > 0
      ? cases
      : await prisma.case.findMany({
          where: {
            projectId: project.id,
            status: { not: "CLOSED" },
          },
          include: { subcontractor: true },
          orderBy: { discoveredAt: "desc" },
          take: 12,
        });

  const source = cases.length > 0 ? cases : openCases;
  const safetyEvents = source.filter((c) => c.category === "SAFETY").length;

  const activities: ActivityRow[] = source.slice(0, 8).map((c, i) => ({
    time: `${String(8 + i).padStart(2, "0")}:00 - ${String(9 + i).padStart(2, "0")}:30`,
    name: c.title,
    status: c.status === "CLOSED" ? "完成" : "进行中",
  }));

  const issues: IssueRow[] = source
    .filter((c) => c.status !== "CLOSED")
    .map((c) => ({
      id: c.caseNo,
      issue: c.title,
      risk: c.severity,
      assignee: c.subcontractor?.name || "未指派",
      deadline: c.dueAt,
      status: c.status,
    }));

  const plans = issues.slice(0, 5).map((i) => `跟進：${i.issue}`);

  let narrative =
    `本日共關注 ${source.length} 項現場事項，安全類 ${safetyEvents} 項，未關閉 ${issues.length} 項。`;

  const aiNarrative = await chatText(
    `你是資深工地文員。根據以下資料寫一段80-120字的專業日報綜述（繁體中文，客觀、可給項目經理看）：
項目：${project.name}
日期：${dateStr}
事項：${source.map((c) => `${c.caseNo} ${c.title}(${c.category}/${c.severity}/${c.status})`).join("；")}
問題：${issues.map((i) => i.issue).join("；") || "無"}`,
  );
  if (aiNarrative) narrative = aiNarrative;

  const data = {
    projectId: project.id,
    date: day,
    weather: opts.weather || project.weather || "晴",
    workerCount: 120 + source.length,
    subcontractorCount: subs,
    equipmentCount: 10,
    materialDeliveries: 3,
    progressPct: Math.min(
      95,
      55 + Math.round(source.filter((c) => c.status === "CLOSED").length * 5),
    ),
    safetyEvents,
    activitiesJson: JSON.stringify(activities),
    tomorrowPlanJson: JSON.stringify(plans),
    issuesJson: JSON.stringify(issues),
    photoPathsJson: JSON.stringify(evidence.map((e) => e.filePath).filter(Boolean)),
    status: "DRAFT" as const,
    reporterName: opts.reporterName || "系統自動",
  };

  const report = await prisma.dailyReport.upsert({
    where: { projectId_date: { projectId: project.id, date: day } },
    create: data,
    update: data,
  });

  const payload: DailyReportPayload = {
    title: `工地日報 ${dateStr}`,
    projectName: project.name,
    siteCode: project.siteCode,
    date: dateStr,
    weather: data.weather,
    reporterName: data.reporterName,
    workerCount: data.workerCount,
    subcontractorCount: data.subcontractorCount,
    equipmentCount: data.equipmentCount,
    materialDeliveries: data.materialDeliveries,
    progressPct: data.progressPct,
    safetyEvents: data.safetyEvents,
    activities,
    issues,
    plans,
    narrative,
  };

  return { report, payload, project };
}

export function dailyPayloadFromDb(
  report: {
    date: Date;
    weather: string | null;
    workerCount: number;
    subcontractorCount: number;
    equipmentCount: number;
    materialDeliveries: number;
    progressPct: number;
    safetyEvents: number;
    activitiesJson: string;
    issuesJson: string;
    tomorrowPlanJson: string;
    reporterName: string | null;
  },
  project: { name: string; siteCode: string },
  narrative?: string,
): DailyReportPayload {
  const dateStr = report.date.toISOString().slice(0, 10);
  return {
    title: `工地日報 ${dateStr}`,
    projectName: project.name,
    siteCode: project.siteCode,
    date: dateStr,
    weather: report.weather || "—",
    reporterName: report.reporterName || "—",
    workerCount: report.workerCount,
    subcontractorCount: report.subcontractorCount,
    equipmentCount: report.equipmentCount,
    materialDeliveries: report.materialDeliveries,
    progressPct: report.progressPct,
    safetyEvents: report.safetyEvents,
    activities: JSON.parse(report.activitiesJson || "[]"),
    issues: JSON.parse(report.issuesJson || "[]"),
    plans: JSON.parse(report.tomorrowPlanJson || "[]"),
    narrative,
  };
}
