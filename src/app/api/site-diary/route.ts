import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { CASE_STATUS_LABELS, CATEGORY_LABELS } from "@/lib/labels";
import { mediaUrl } from "@/lib/media";

/** Soft site diary rollup for a calendar day (private projects). */
export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const dateStr = req.nextUrl.searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const day = new Date(dateStr);
  day.setHours(0, 0, 0, 0);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  const now = new Date();

  const project = await prisma.project.findFirst();
  if (!project) return NextResponse.json({ error: "No project" }, { status: 400 });

  const [opened, closed, overdue, openSafety, photos, openCases] = await Promise.all([
    prisma.case.count({
      where: { projectId: project.id, discoveredAt: { gte: day, lt: next } },
    }),
    prisma.case.count({
      where: { projectId: project.id, closedAt: { gte: day, lt: next } },
    }),
    prisma.case.count({
      where: {
        projectId: project.id,
        status: { not: "CLOSED" },
        dueAt: { lt: now },
      },
    }),
    prisma.case.count({
      where: {
        projectId: project.id,
        category: "SAFETY",
        status: { not: "CLOSED" },
      },
    }),
    prisma.evidence.findMany({
      where: {
        projectId: project.id,
        capturedAt: { gte: day, lt: next },
        type: "PHOTO",
      },
      orderBy: { capturedAt: "desc" },
      take: 12,
      select: {
        id: true,
        title: true,
        filePath: true,
        mime: true,
        caseId: true,
      },
    }),
    prisma.case.findMany({
      where: { projectId: project.id, status: { not: "CLOSED" } },
      orderBy: { dueAt: "asc" },
      take: 8,
      select: {
        caseNo: true,
        title: true,
        category: true,
        status: true,
        dueAt: true,
      },
    }),
  ]);

  const photoRows = photos.map((p) => ({
    id: p.id,
    title: p.title,
    href: mediaUrl(p.filePath),
    caseId: p.caseId,
  }));

  const lines = [
    `【工地日記 ${dateStr}】${project.name}`,
    `今日新開 ${opened} · 今日關閉 ${closed} · 目前逾期 ${overdue} · 未關安全 ${openSafety}`,
    "",
    ...openCases.map(
      (c) =>
        `• ${c.caseNo} ${c.title}（${CATEGORY_LABELS[c.category] || c.category}/${CASE_STATUS_LABELS[c.status] || c.status}）`,
    ),
    "",
    "— AxonCase 軟日記",
  ];

  return NextResponse.json({
    date: dateStr,
    projectName: project.name,
    siteCode: project.siteCode,
    opened,
    closed,
    overdue,
    openSafety,
    photos: photoRows,
    openCases,
    shareText: lines.join("\n"),
  });
}
