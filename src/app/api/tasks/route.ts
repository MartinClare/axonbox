import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, resolveActorId } from "@/lib/session";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const where: Prisma.TaskWhereInput = status ? { status } : {};
  const tasks = await prisma.task.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      case: true,
      assignee: true,
    },
  });
  return NextResponse.json(tasks);
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const existing = await prisma.task.findUnique({ where: { id: body.id } });
    if (!existing) {
      return NextResponse.json({ error: "task not found" }, { status: 404 });
    }

    const actorId = await resolveActorId(session!.user.id);

    const updated = await prisma.task.update({
      where: { id: body.id },
      data: {
        status: body.status,
        title: body.title,
        instructions: body.instructions,
        assigneeId: body.assigneeId,
        dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
      },
    });

    if (body.status === "IN_PROGRESS") {
      await prisma.case.update({
        where: { id: updated.caseId },
        data: { status: "IN_PROGRESS" },
      });
      await prisma.caseEvent.create({
        data: {
          caseId: updated.caseId,
          type: "PROGRESS",
          note: "任務進行中",
          actorId,
        },
      });
    }
    if (body.status === "PENDING_REVIEW") {
      await prisma.case.update({
        where: { id: updated.caseId },
        data: { status: "PENDING_REVIEW" },
      });
      await prisma.caseEvent.create({
        data: {
          caseId: updated.caseId,
          type: "REVIEW",
          note: "提交核驗",
          actorId,
        },
      });
    }
    if (body.status === "DONE") {
      await prisma.case.update({
        where: { id: updated.caseId },
        data: { status: "CLOSED", closedAt: new Date() },
      });
      await prisma.caseEvent.create({
        data: {
          caseId: updated.caseId,
          type: "CLOSE",
          note: "任務完成，事件關閉",
          actorId,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (e) {
    console.error("[tasks.PATCH]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "update failed" },
      { status: 500 },
    );
  }
}
