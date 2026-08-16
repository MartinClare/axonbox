import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, resolveActorId } from "@/lib/session";
import { nextCaseNo } from "@/lib/case-no";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") || undefined;
  const category = searchParams.get("category") || undefined;
  const status = searchParams.get("status") || undefined;
  const severity = searchParams.get("severity") || undefined;
  const brief = searchParams.get("brief") === "1";

  const where: Prisma.CaseWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { title: { contains: q } },
              { caseNo: { contains: q } },
              { location: { contains: q } },
              { description: { contains: q } },
            ],
          }
        : {},
      category ? { category } : {},
      status ? { status } : {},
      severity ? { severity } : {},
    ],
  };

  if (brief) {
    const cases = await prisma.case.findMany({
      where,
      orderBy: { discoveredAt: "desc" },
      take: 80,
      select: {
        id: true,
        caseNo: true,
        title: true,
        status: true,
        category: true,
      },
    });
    return NextResponse.json(cases);
  }

  const cases = await prisma.case.findMany({
    where,
    orderBy: { discoveredAt: "desc" },
    include: {
      assignee: true,
      subcontractor: true,
      evidence: { take: 1 },
      tasks: true,
    },
  });
  return NextResponse.json(cases);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const body = await req.json();
    const project = await prisma.project.findFirst();
    if (!project) {
      return NextResponse.json({ error: "No project" }, { status: 400 });
    }

    const actorId = await resolveActorId(session!.user.id);
    const assigneeId =
      (body.assigneeId ? await resolveActorId(body.assigneeId) : null) || actorId;

    const caseNo = body.caseNo || (await nextCaseNo());
    const created = await prisma.case.create({
      data: {
        caseNo,
        title: body.title,
        description: body.description || "",
        category: body.category || "OTHER",
        severity: body.severity || "MEDIUM",
        location: body.location || "待確認",
        recommendation: body.recommendation,
        sourceType: body.sourceType || "MANUAL",
        status: "OPEN",
        projectId: project.id,
        assigneeId: assigneeId || undefined,
        subcontractorId: body.subcontractorId || undefined,
        dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
      },
    });

    await prisma.caseEvent.create({
      data: {
        caseId: created.id,
        type: "CREATE",
        note: "\u5efa\u7acb\u4e8b\u4ef6",
        actorId,
      },
    });

    if (body.evidenceId) {
      await prisma.evidence.update({
        where: { id: body.evidenceId },
        data: { caseId: created.id, status: "IN_PROGRESS" },
      });
    }

    if (body.createTask) {
      await prisma.task.create({
        data: {
          title: `跟進：${created.title}`,
          instructions: body.recommendation || created.description,
          caseId: created.id,
          assigneeId: assigneeId || undefined,
          dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
        },
      });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("[cases.POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "create failed" },
      { status: 500 },
    );
  }
}
