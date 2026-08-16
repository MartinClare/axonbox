import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, requireSession, resolveActorId } from "@/lib/session";
import { Prisma } from "@prisma/client";

const taskInclude = {
  case: { select: { id: true, caseNo: true, title: true, status: true } },
  meeting: { select: { id: true, title: true, meetingAt: true } },
  assignee: { select: { id: true, name: true, email: true } },
} as const;

async function syncCaseFromStatus(
  caseId: string | null | undefined,
  status: string,
  actorId: string | null,
) {
  if (!caseId) return;
  if (status === "IN_PROGRESS") {
    await prisma.case.update({
      where: { id: caseId },
      data: { status: "IN_PROGRESS" },
    });
    await prisma.caseEvent.create({
      data: { caseId, type: "PROGRESS", note: "任務進行中", actorId },
    });
  }
  if (status === "PENDING_REVIEW") {
    await prisma.case.update({
      where: { id: caseId },
      data: { status: "PENDING_REVIEW" },
    });
    await prisma.caseEvent.create({
      data: { caseId, type: "REVIEW", note: "提交核驗", actorId },
    });
  }
  if (status === "DONE") {
    await prisma.case.update({
      where: { id: caseId },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    await prisma.caseEvent.create({
      data: { caseId, type: "CLOSE", note: "任務完成，事件關閉", actorId },
    });
  }
  if (status === "PENDING") {
    await prisma.case.update({
      where: { id: caseId },
      data: { status: "OPEN", closedAt: null },
    });
  }
}

export async function DELETE() {
  const { error } = await requirePermission("org:admin");
  if (error) return error;
  const result = await prisma.task.deleteMany();
  return NextResponse.json({ ok: true, deleted: result.count });
}

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;
  const status = req.nextUrl.searchParams.get("status") || undefined;
  const archived = req.nextUrl.searchParams.get("archived") === "1";
  const scope = req.nextUrl.searchParams.get("scope"); // case | meeting | all
  const where: Prisma.TaskWhereInput = {
    ...(status ? { status } : {}),
    archived,
    ...(scope === "case"
      ? { meetingId: null }
      : scope === "meeting"
        ? { meetingId: { not: null } }
        : {}),
  };
  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: taskInclude,
  });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const body = await req.json();
    const title = String(body.title || "").trim();
    const caseId = body.caseId ? String(body.caseId).trim() : "";
    const meetingId = body.meetingId ? String(body.meetingId).trim() : "";
    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
    if (!caseId && !meetingId) {
      return NextResponse.json({ error: "caseId or meetingId required" }, { status: 400 });
    }
    if (caseId && meetingId) {
      return NextResponse.json({ error: "task cannot belong to both" }, { status: 400 });
    }

    if (caseId) {
      const linked = await prisma.case.findUnique({ where: { id: caseId } });
      if (!linked) return NextResponse.json({ error: "case not found" }, { status: 404 });
    }
    if (meetingId) {
      const linked = await prisma.meeting.findUnique({ where: { id: meetingId } });
      if (!linked) return NextResponse.json({ error: "meeting not found" }, { status: 404 });
    }

    const status = String(body.status || "PENDING");
    const orderWhere = meetingId
      ? { meetingId, archived: false }
      : { status, caseId: { not: null }, archived: false };
    const maxOrder = await prisma.task.aggregate({
      where: orderWhere,
      _max: { sortOrder: true },
    });

    const created = await prisma.task.create({
      data: {
        title,
        instructions: body.instructions ? String(body.instructions) : null,
        status,
        caseId: caseId || null,
        meetingId: meetingId || null,
        assigneeId: body.assigneeId || null,
        dueAt: body.dueAt
          ? new Date(
              String(body.dueAt).length === 10 ? `${body.dueAt}T12:00:00` : body.dueAt,
            )
          : null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        labelsJson: typeof body.labelsJson === "string" ? body.labelsJson : "[]",
        coverColor: body.coverColor || null,
        checklistJson: typeof body.checklistJson === "string" ? body.checklistJson : "[]",
      },
      include: taskInclude,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("[tasks.POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "create failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const body = await req.json();

    if (Array.isArray(body.reorder)) {
      const rows = body.reorder.filter(
        (row: { id?: unknown; status?: unknown; sortOrder?: unknown }) =>
          typeof row?.id === "string" &&
          typeof row?.status === "string" &&
          typeof row?.sortOrder === "number",
      ) as Array<{ id: string; status: string; sortOrder: number; meetingId?: string | null }>;
      if (rows.length === 0) {
        return NextResponse.json({ error: "reorder required" }, { status: 400 });
      }
      const actorId = await resolveActorId(session!.user.id);
      const existing = await prisma.task.findMany({
        where: { id: { in: rows.map((r) => r.id) } },
        select: { id: true, status: true, caseId: true, meetingId: true },
      });
      const prev = new Map(existing.map((t) => [t.id, t]));
      await prisma.$transaction(
        rows.map((row) => {
          const before = prev.get(row.id);
          // Minutes tasks stay in their meeting list — only reorder, keep status/meeting
          if (before?.meetingId) {
            return prisma.task.update({
              where: { id: row.id },
              data: { sortOrder: row.sortOrder },
            });
          }
          return prisma.task.update({
            where: { id: row.id },
            data: { status: row.status, sortOrder: row.sortOrder },
          });
        }),
      );
      for (const row of rows) {
        const before = prev.get(row.id);
        if (before && !before.meetingId && before.caseId && before.status !== row.status) {
          await syncCaseFromStatus(before.caseId, row.status, actorId);
        }
      }
      return NextResponse.json({ ok: true, moved: rows.length });
    }

    if (!body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const existing = await prisma.task.findUnique({ where: { id: body.id } });
    if (!existing) {
      return NextResponse.json({ error: "task not found" }, { status: 404 });
    }

    if (body.delete === true) {
      await prisma.task.delete({ where: { id: body.id } });
      return NextResponse.json({ ok: true, deleted: 1 });
    }

    const data: Prisma.TaskUpdateInput = {};
    if (body.status !== undefined) data.status = String(body.status);
    if (body.title !== undefined) data.title = String(body.title);
    if (body.instructions !== undefined) data.instructions = body.instructions;
    if (body.assigneeId !== undefined) {
      data.assignee = body.assigneeId
        ? { connect: { id: String(body.assigneeId) } }
        : { disconnect: true };
    }
    if (body.dueAt !== undefined) {
      data.dueAt = body.dueAt
        ? new Date(String(body.dueAt).length === 10 ? `${body.dueAt}T12:00:00` : body.dueAt)
        : null;
    }
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;
    if (body.labelsJson !== undefined) data.labelsJson = String(body.labelsJson);
    if (body.coverColor !== undefined) data.coverColor = body.coverColor || null;
    if (body.checklistJson !== undefined) data.checklistJson = String(body.checklistJson);
    if (body.archived !== undefined) data.archived = Boolean(body.archived);

    const updated = await prisma.task.update({
      where: { id: body.id },
      data,
      include: taskInclude,
    });

    if (
      body.status &&
      body.status !== existing.status &&
      existing.caseId &&
      !existing.meetingId
    ) {
      const actorId = await resolveActorId(session!.user.id);
      await syncCaseFromStatus(updated.caseId, String(body.status), actorId);
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
