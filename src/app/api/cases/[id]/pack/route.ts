import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { findAfterEvidence } from "@/lib/case-closeout";
import { buildCasePackPdf, type CasePackPayload } from "@/lib/reports/case-pack-pdf";
import { getStoredFile, objectKeyFromPath } from "@/lib/storage";
import { saveBuffer } from "@/lib/upload";
import { formatDate } from "@/lib/labels";

type Ctx = { params: Promise<{ id: string }> };

async function toDataUrl(filePath: string | null | undefined, mime: string | null | undefined) {
  if (!filePath) return undefined;
  try {
    const buf = await getStoredFile(objectKeyFromPath(filePath));
    if (!buf) return undefined;
    const m = mime || "image/jpeg";
    if (!m.startsWith("image/")) return undefined;
    return `data:${m};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;

  const item = await prisma.case.findUnique({
    where: { id },
    include: {
      assignee: true,
      subcontractor: true,
      project: true,
      events: { include: { actor: true }, orderBy: { createdAt: "asc" } },
      evidence: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const after = findAfterEvidence(item.evidence, item.events);
  const afterIds = new Set(after.map((e) => e.id));
  const before = item.evidence.filter((e) => !afterIds.has(e.id));

  const beforeImages: Array<{ title: string; dataUrl?: string }> = [];
  for (const e of before.filter((x) => x.type === "PHOTO").slice(0, 4)) {
    beforeImages.push({
      title: e.title,
      dataUrl: await toDataUrl(e.filePath, e.mime),
    });
  }
  const afterImages: Array<{ title: string; dataUrl?: string }> = [];
  for (const e of after.filter((x) => x.type === "PHOTO").slice(0, 4)) {
    afterImages.push({
      title: e.title,
      dataUrl: await toDataUrl(e.filePath, e.mime),
    });
  }

  const payload: CasePackPayload = {
    caseNo: item.caseNo,
    title: item.title,
    description: item.description,
    category: item.category,
    severity: item.severity,
    location: item.location,
    status: item.status,
    projectName: item.project.name,
    siteCode: item.project.siteCode,
    assignee: item.assignee?.name || "—",
    subcontractor: item.subcontractor?.name || "—",
    discoveredAt: formatDate(item.discoveredAt),
    dueAt: item.dueAt ? formatDate(item.dueAt) : "—",
    closedAt: item.closedAt ? formatDate(item.closedAt) : "—",
    recommendation: item.recommendation || "",
    events: item.events.map((e) => ({
      at: formatDate(e.createdAt),
      type: e.type,
      note: e.note || "",
      actor: e.actor?.name || "",
    })),
    beforeImages,
    afterImages,
    generatedAt: new Date().toLocaleString("zh-HK"),
  };

  const pdf = await buildCasePackPdf(payload);
  const filename = `${item.caseNo}-close-pack.pdf`;
  await saveBuffer(pdf, filename, "exports", "application/pdf");
  return NextResponse.json({ filePath: `/api/files/exports/${filename}` });
}
