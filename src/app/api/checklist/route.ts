import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, resolveActorId } from "@/lib/session";
import { nextCaseNo } from "@/lib/case-no";
import { ensureAfterTag } from "@/lib/case-closeout";

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
    const actorId = await resolveActorId((session.user as { id?: string }).id);

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

    /** Inspect-lite: Pass stores evidence; Fail creates a Case. */
    if (action === "inspectResult") {
      const id = String(body.id || "");
      const result = String(body.result || "").toUpperCase();
      if (result !== "PASS" && result !== "FAIL") {
        return NextResponse.json({ error: "result must be PASS or FAIL" }, { status: 400 });
      }
      const run = await prisma.checklistRun.findUnique({
        where: { id },
        include: { template: true },
      });
      if (!run) return NextResponse.json({ error: "找不到點檢" }, { status: 404 });

      const project = await prisma.project.findFirst();
      if (!project) return NextResponse.json({ error: "No project" }, { status: 400 });

      const itemsJson =
        typeof body.itemsJson === "string"
          ? body.itemsJson
          : body.items
            ? JSON.stringify(body.items)
            : run.itemsJson;
      const note = body.note ? String(body.note) : run.note;

      const updated = await prisma.checklistRun.update({
        where: { id },
        data: {
          itemsJson,
          note,
          status: result === "PASS" ? "PASSED" : "FAILED",
          completedAt: new Date(),
        },
      });

      if (result === "PASS") {
        const evidence = await prisma.evidence.create({
          data: {
            type: "DOC",
            title: `點檢通過：${run.title}`,
            chatText: [
              `模板：${run.template.name}`,
              note ? `備註：${note}` : "",
              `項目：${itemsJson}`,
            ]
              .filter(Boolean)
              .join("\n"),
            tagsJson: ensureAfterTag("[]"),
            source: "UPLOAD",
            category: run.template.category || "SITE",
            projectId: project.id,
            status: "HANDLED",
          },
        });
        return NextResponse.json({ run: updated, evidence, case: null });
      }

      const failedItems = (() => {
        try {
          const items = JSON.parse(itemsJson) as Array<{ text?: string; checked?: boolean }>;
          return items.filter((i) => !i.checked).map((i) => i.text || "未勾選項");
        } catch {
          return [];
        }
      })();

      const caseNo = await nextCaseNo();
      const created = await prisma.case.create({
        data: {
          caseNo,
          title: `點檢不合格：${run.title}`,
          description:
            failedItems.length > 0
              ? `以下項目未通過：\n${failedItems.map((t) => `• ${t}`).join("\n")}`
              : note || `現場點檢「${run.title}」判定不合格`,
          category:
            run.template.category === "SAFETY" || run.template.category === "QUALITY"
              ? run.template.category
              : "QUALITY",
          severity: "MEDIUM",
          location: "現場點檢",
          recommendation: note || "請按點檢結果整改後重新申請檢查",
          sourceType: "CHECKLIST",
          status: "OPEN",
          projectId: project.id,
          assigneeId: actorId || undefined,
        },
      });
      await prisma.caseEvent.create({
        data: {
          caseId: created.id,
          type: "CREATE",
          note: `由點檢不合格自動建立（${run.title}）`,
          actorId,
        },
      });
      await prisma.task.create({
        data: {
          title: `跟進：${created.title}`,
          instructions: created.recommendation || created.description,
          caseId: created.id,
          assigneeId: actorId || undefined,
          status: "PENDING",
        },
      });
      return NextResponse.json({ run: updated, case: created, evidence: null });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Checklist 失敗" }, { status: 500 });
  }
}
