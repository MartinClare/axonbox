import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireSession, resolveActorId } from "@/lib/session";
import { hasAfterEvidence } from "@/lib/case-closeout";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  const item = await prisma.case.findUnique({
    where: { id },
    include: {
      assignee: true,
      subcontractor: true,
      tasks: { include: { assignee: true } },
      events: { include: { actor: true }, orderBy: { createdAt: "asc" } },
      evidence: { orderBy: { createdAt: "desc" } },
      project: true,
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const actorId = await resolveActorId((session.user as { id?: string }).id);
    const data: Record<string, unknown> = {};
    for (const key of [
      "title",
      "description",
      "category",
      "severity",
      "location",
      "recommendation",
      "status",
      "assigneeId",
      "subcontractorId",
    ]) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    if (body.dueAt !== undefined) {
      data.dueAt = body.dueAt ? new Date(String(body.dueAt)) : null;
    }
    if (body.status === "CLOSED") data.closedAt = new Date();
    if (typeof data.assigneeId === "string") {
      data.assigneeId = await resolveActorId(data.assigneeId);
    }

    if (body.status === "CLOSED") {
      const current = await prisma.case.findUnique({
        where: { id },
        include: {
          evidence: true,
          events: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const hasAfter = hasAfterEvidence(current.evidence, current.events);
      const waive = body.waiveCloseEvidence === true;
      if (!hasAfter && !waive) {
        return NextResponse.json(
          {
            error: "CLOSE_EVIDENCE_REQUIRED",
            message: "關閉前請上傳或標記「整改後」證據，或選擇無圖關閉並填寫原因",
          },
          { status: 400 },
        );
      }
      if (!hasAfter && waive) {
        const note = String(body.eventNote || "").trim();
        if (!note) {
          return NextResponse.json(
            { error: "請填寫無圖關閉原因", message: "請填寫無圖關閉原因" },
            { status: 400 },
          );
        }
      }
    }

    const updated = await prisma.case.update({ where: { id }, data });

    // Avoid duplicate CLOSE + CLOSE_WAIVE events
    const shouldLogEvent =
      Boolean(body.eventType) ||
      (body.status === "CLOSED" && body.waiveCloseEvidence === true);

    if (shouldLogEvent) {
      const eventType =
        body.status === "CLOSED" && body.waiveCloseEvidence === true
          ? "CLOSE_WAIVE"
          : String(body.eventType || "CLOSE");
      await prisma.caseEvent.create({
        data: {
          caseId: id,
          type: eventType,
          note: body.eventNote ? String(body.eventNote) : null,
          actorId,
        },
      });
    }

    if (body.status === "ASSIGNED" || body.eventType === "ASSIGN") {
      const taskAssignee =
        (await resolveActorId(
          (body.taskAssigneeId as string) ||
            (body.assigneeId as string) ||
            session!.user.id,
        )) || actorId;
      const existing = await prisma.task.findFirst({ where: { caseId: id } });
      if (!existing) {
        await prisma.task.create({
          data: {
            title: `整改：${updated.title}`,
            instructions:
              (body.instructions as string) ||
              updated.recommendation ||
              updated.description,
            caseId: id,
            assigneeId: taskAssignee || undefined,
            dueAt: body.dueAt ? new Date(String(body.dueAt)) : updated.dueAt,
            status: "PENDING",
          },
        });
      } else {
        await prisma.task.update({
          where: { id: existing.id },
          data: {
            instructions:
              (body.instructions as string) || existing.instructions,
            dueAt: body.dueAt ? new Date(String(body.dueAt)) : existing.dueAt,
            assigneeId: taskAssignee || existing.assigneeId,
            status: "IN_PROGRESS",
          },
        });
      }
    }

    if (body.status === "IN_PROGRESS") {
      await prisma.task.updateMany({
        where: { caseId: id, status: "PENDING" },
        data: { status: "IN_PROGRESS" },
      });
    }

    if (body.status === "PENDING_REVIEW") {
      await prisma.task.updateMany({
        where: { caseId: id, status: { in: ["PENDING", "IN_PROGRESS"] } },
        data: { status: "PENDING_REVIEW" },
      });
    }

    if (body.status === "CLOSED") {
      await prisma.task.updateMany({
        where: { caseId: id },
        data: { status: "DONE" },
      });
      await prisma.evidence.updateMany({
        where: { caseId: id },
        data: { status: "HANDLED" },
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/cases/[id] failed", err);
    return NextResponse.json(
      { error: "Update failed", detail: String(err) },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { error } = await requirePermission("cases:write");
  if (error) return error;
  const { id } = await ctx.params;

  const existing = await prisma.case.findUnique({
    where: { id },
    select: { id: true, caseNo: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await prisma.$transaction([
      prisma.evidence.updateMany({ where: { caseId: id }, data: { caseId: null } }),
      prisma.inboxMessage.updateMany({ where: { caseId: id }, data: { caseId: null } }),
      prisma.case.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true, deleted: 1, caseNo: existing.caseNo });
  } catch (err) {
    console.error("DELETE /api/cases/[id] failed", err);
    return NextResponse.json(
      { error: "Delete failed", detail: String(err) },
      { status: 500 },
    );
  }
}
