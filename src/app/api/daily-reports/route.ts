import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { upsertDailyReportDraft, dailyPayloadFromDb } from "@/lib/reports/draft";
import { generateReports } from "@/lib/reports/generate";
import { buildDailyDocx } from "@/lib/reports/docx";
import { buildDailyPdf } from "@/lib/reports/pdf";
import { saveBuffer } from "@/lib/upload";

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;
  const dateStr = req.nextUrl.searchParams.get("date");
  const project = await prisma.project.findFirst();
  if (!project) return NextResponse.json({ error: "No project" }, { status: 400 });

  if (dateStr) {
    const day = new Date(dateStr);
    day.setHours(0, 0, 0, 0);
    const report = await prisma.dailyReport.findUnique({
      where: { projectId_date: { projectId: project.id, date: day } },
      include: { exports: true },
    });
    return NextResponse.json(report);
  }

  const list = await prisma.dailyReport.findMany({
    where: { projectId: project.id },
    orderBy: { date: "desc" },
    include: { exports: true },
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  const body = await req.json();
  const project = await prisma.project.findFirst();
  if (!project) return NextResponse.json({ error: "No project" }, { status: 400 });

  if (body.action === "generate") {
    try {
      const { report } = await upsertDailyReportDraft({
        date: body.date,
        weather: body.weather,
        reporterName: session!.user.name || undefined,
      });
      return NextResponse.json(report);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "generate failed" },
        { status: 500 },
      );
    }
  }

  if (body.action === "oneclick") {
    try {
      const result = await generateReports({
        kind: "daily",
        date: body.date,
        formats: body.formats || ["docx", "pdf"],
        reporterName: session!.user.name || undefined,
      });
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "oneclick failed" },
        { status: 500 },
      );
    }
  }

  if (body.action === "update" && body.id) {
    const updated = await prisma.dailyReport.update({
      where: { id: body.id },
      data: {
        weather: body.weather,
        workerCount: body.workerCount,
        subcontractorCount: body.subcontractorCount,
        progressPct: body.progressPct,
        activitiesJson: body.activitiesJson,
        tomorrowPlanJson: body.tomorrowPlanJson,
        issuesJson: body.issuesJson,
        status: body.status,
      },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

/** Export existing draft as Word/PDF (default both via formats) */
export async function PUT(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;
  const body = await req.json();
  const report = await prisma.dailyReport.findUnique({ where: { id: body.id } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const project = await prisma.project.findUnique({ where: { id: report.projectId } });
  if (!project) return NextResponse.json({ error: "No project" }, { status: 400 });

  const formats: Array<"docx" | "pdf"> = body.formats ||
    (body.format ? [body.format] : ["docx", "pdf"]);
  const payload = dailyPayloadFromDb(report, project);
  const stamp = Date.now();
  const exports = [];

  for (const format of formats) {
    if (format === "docx") {
      const bytes = await buildDailyDocx(payload);
      const filename = `daily-${payload.date}-${stamp}.docx`;
      await saveBuffer(
        bytes,
        filename,
        "exports",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      const filePath = `/api/files/exports/${filename}`;
      exports.push(
        await prisma.reportExport.create({
          data: {
            dailyReportId: report.id,
            format: "DOCX",
            filePath,
            title: payload.title,
          },
        }),
      );
    }
    if (format === "pdf") {
      const bytes = await buildDailyPdf(payload);
      const filename = `daily-${payload.date}-${stamp}.pdf`;
      await saveBuffer(bytes, filename, "exports", "application/pdf");
      const filePath = `/api/files/exports/${filename}`;
      exports.push(
        await prisma.reportExport.create({
          data: {
            dailyReportId: report.id,
            format: "PDF",
            filePath,
            title: payload.title,
          },
        }),
      );
    }
  }

  return NextResponse.json({ ok: true, exports, filePath: exports[0]?.filePath });
}
