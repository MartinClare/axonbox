import { hasAIKey, chatText } from "@/lib/ai";
import { upsertDailyReportDraft } from "./draft";
import { buildDailyDocx, buildEventDocx } from "./docx";
import { buildDailyPdf, buildEventPdf } from "./pdf";
import type { EventReportPayload, ReportFormat } from "./types";
import { prisma } from "@/lib/prisma";
import { saveBuffer } from "@/lib/upload";
import { CATEGORY_LABELS, CASE_STATUS_LABELS, SEVERITY_LABELS } from "@/lib/labels";

export type ReportKind =
  | "daily"
  | "weekly"
  | "monthly"
  | "acceptance"
  | "events"
  | "safety"
  | "quality";

async function saveExport(opts: {
  bytes: Buffer;
  filename: string;
  format: string;
  title: string;
  mime: string;
  dailyReportId?: string;
}) {
  await saveBuffer(opts.bytes, opts.filename, "exports", opts.mime);
  const filePath = `/api/files/exports/${opts.filename}`;
  const exp = await prisma.reportExport.create({
    data: {
      format: opts.format,
      filePath,
      title: opts.title,
      dailyReportId: opts.dailyReportId,
    },
  });
  return {
    id: exp.id,
    format: exp.format,
    filePath,
    filename: opts.filename,
    title: opts.title,
  };
}

function rangeFor(kind: ReportKind, dateStr?: string) {
  const base = dateStr ? new Date(dateStr) : new Date();
  base.setHours(0, 0, 0, 0);
  if (kind === "weekly") {
    const day = base.getDay() || 7;
    const start = new Date(base);
    start.setDate(base.getDate() - (day - 1));
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end, label: `${start.toISOString().slice(0, 10)} ~ ${new Date(end.getTime() - 1).toISOString().slice(0, 10)}` };
  }
  if (kind === "monthly") {
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    return {
      start,
      end,
      label: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    };
  }
  return { start: undefined as Date | undefined, end: undefined as Date | undefined, label: "" };
}

async function buildEventPayload(
  kind: Exclude<ReportKind, "daily">,
  date?: string,
): Promise<EventReportPayload> {
  const project = await prisma.project.findFirst();
  if (!project) throw new Error("No project");

  const { start, end, label } = rangeFor(kind, date);
  const where: Record<string, unknown> = {};
  if (kind === "safety") where.category = "SAFETY";
  if (kind === "quality") where.category = "QUALITY";
  if (kind === "weekly" || kind === "monthly") {
    where.discoveredAt = { gte: start, lt: end };
  }
  if (kind === "acceptance") {
    where.status = "CLOSED";
    if (start && end) where.closedAt = { gte: start, lt: end };
  }

  const cases = await prisma.case.findMany({
    where,
    include: { subcontractor: true, assignee: true, evidence: { take: 3 } },
    orderBy: { discoveredAt: "desc" },
  });

  const titleMap: Record<string, string> = {
    events: "工地事件總覽報告",
    safety: "安全事件報告",
    quality: "質量事件匯總報告",
    weekly: `工地週報 ${label}`,
    monthly: `工地月報 ${label}`,
    acceptance: `驗收報告 ${label || new Date().toISOString().slice(0, 10)}`,
  };

  let summary = `共 ${cases.length} 則事件。高風險 ${cases.filter((c) => c.severity === "HIGH").length} 則，未關閉 ${cases.filter((c) => c.status !== "CLOSED").length} 則。`;
  if (kind === "acceptance") {
    summary = `本驗收範圍共 ${cases.length} 則已關閉事項，可作為竣工／階段驗收附件。請核對證據照片與整改記錄。`;
  }

  if (hasAIKey() && cases.length) {
    const aiSummary = await chatText(
      `用80-120字寫工程管理摘要（繁體中文，可提及香港工地行政／HyD 合規意識，勿捏造許可編號）：${cases
        .slice(0, 20)
        .map(
          (c) =>
            `${c.caseNo} ${c.title} ${CATEGORY_LABELS[c.category]}/${SEVERITY_LABELS[c.severity]}/${CASE_STATUS_LABELS[c.status]}`,
        )
        .join("；")}`,
    );
    if (aiSummary) summary = aiSummary;
  }

  return {
    title: titleMap[kind] || "工程報告",
    projectName: project.name,
    siteCode: project.siteCode,
    generatedAt: new Date().toLocaleString("zh-HK"),
    kind: kind === "weekly" || kind === "monthly" || kind === "acceptance" ? "events" : kind,
    summary,
    rows: cases.map((c) => ({
      caseNo: c.caseNo,
      title: c.title,
      category: c.category,
      severity: c.severity,
      location: c.location,
      status: c.status,
      subcontractor: c.subcontractor?.name || "",
      assignee: c.assignee?.name || "",
      discoveredAt: c.discoveredAt.toISOString(),
      dueAt: c.dueAt?.toISOString() || "",
    })),
  };
}

/**
 * One-click report generation: daily / weekly / monthly / acceptance / events…
 */
export async function generateReports(opts: {
  kind?: ReportKind;
  date?: string;
  formats?: ReportFormat[];
  reporterName?: string;
}) {
  const kind = opts.kind || "daily";
  const formats = opts.formats?.length ? opts.formats : (["docx", "pdf"] as ReportFormat[]);
  const stamp = Date.now();
  const exports: Array<{ format: string; filePath: string; filename: string; title: string }> =
    [];

  if (kind === "daily") {
    const { report, payload } = await upsertDailyReportDraft({
      date: opts.date,
      reporterName: opts.reporterName,
    });

    for (const format of formats) {
      if (format === "docx") {
        const bytes = await buildDailyDocx(payload);
        const filename = `daily-${payload.date}-${stamp}.docx`;
        exports.push(
          await saveExport({
            bytes,
            filename,
            format: "DOCX",
            title: payload.title,
            mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            dailyReportId: report.id,
          }),
        );
      }
      if (format === "pdf") {
        const bytes = await buildDailyPdf(payload);
        const filename = `daily-${payload.date}-${stamp}.pdf`;
        exports.push(
          await saveExport({
            bytes,
            filename,
            format: "PDF",
            title: payload.title,
            mime: "application/pdf",
            dailyReportId: report.id,
          }),
        );
      }
    }

    return {
      kind,
      reportId: report.id,
      date: payload.date,
      narrative: payload.narrative,
      exports,
    };
  }

  const payload = await buildEventPayload(kind, opts.date);
  for (const format of formats) {
    if (format === "docx") {
      const bytes = await buildEventDocx(payload);
      const filename = `${kind}-${stamp}.docx`;
      exports.push(
        await saveExport({
          bytes,
          filename,
          format: "DOCX",
          title: payload.title,
          mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      );
    }
    if (format === "pdf") {
      const bytes = await buildEventPdf(payload);
      const filename = `${kind}-${stamp}.pdf`;
      exports.push(
        await saveExport({
          bytes,
          filename,
          format: "PDF",
          title: payload.title,
          mime: "application/pdf",
        }),
      );
    }
  }

  return {
    kind,
    count: payload.rows.length,
    summary: payload.summary,
    exports,
  };
}
