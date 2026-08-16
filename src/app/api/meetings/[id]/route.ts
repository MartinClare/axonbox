import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;

  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      tasks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          assignee: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!meeting) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(meeting);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;

  const existing = await prisma.meeting.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const data: { title?: string; meetingAt?: Date | null; sortOrder?: number } = {};
  if (body.title !== undefined) {
    const title = String(body.title || "").trim();
    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
    data.title = title;
  }
  if (body.meetingAt !== undefined) {
    data.meetingAt = body.meetingAt
      ? new Date(
          String(body.meetingAt).length === 10
            ? `${body.meetingAt}T12:00:00`
            : body.meetingAt,
        )
      : null;
  }
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;

  const updated = await prisma.meeting.update({ where: { id }, data });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;

  const existing = await prisma.meeting.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.meeting.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: 1 });
}
