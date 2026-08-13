import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

export async function GET() {
  const { error } = await requirePermission("checklist:read");
  if (error) return error;
  const [templates, runs] = await Promise.all([
    prisma.checklistTemplate.findMany({ orderBy: { name: "asc" } }),
    prisma.checklistRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { template: { select: { name: true, category: true } } },
    }),
  ]);
  return NextResponse.json({ templates, runs });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requirePermission("checklist:write");
  if (error) return error;
  try {
    const body = await req.json();
    const action = String(body.action || "start");

    if (action === "start") {
      const templateId = String(body.templateId || "");
      const template = await prisma.checklistTemplate.findUnique({
        where: { id: templateId },
      });
      if (!template) {
        return NextResponse.json({ error: "找不到模板" }, { status: 404 });
      }
      const project = await prisma.project.findFirst();
      if (!project) {
        return NextResponse.json({ error: "No project" }, { status: 400 });
      }
      const run = await prisma.checklistRun.create({
        data: {
          templateId: template.id,
          projectId: project.id,
          title: body.title || template.name,
          status: "IN_PROGRESS",
          itemsJson: template.itemsJson,
          createdById: (session.user as { id?: string }).id,
        },
      });
      return NextResponse.json(run);
    }

    if (action === "save") {
      const id = String(body.id || "");
      const itemsJson =
        typeof body.itemsJson === "string"
          ? body.itemsJson
          : JSON.stringify(body.items || []);
      const done = Boolean(body.complete);
      const run = await prisma.checklistRun.update({
        where: { id },
        data: {
          itemsJson,
          note: body.note || null,
          status: done ? "DONE" : "IN_PROGRESS",
          completedAt: done ? new Date() : null,
        },
      });
      return NextResponse.json(run);
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Checklist 失敗" }, { status: 500 });
  }
}
