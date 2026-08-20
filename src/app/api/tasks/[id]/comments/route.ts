import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, resolveActorId } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;
  const body = (await req.json()) as { body?: string };
  const text = String(body.body || "").trim();
  if (!text) return NextResponse.json({ error: "body required" }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id }, select: { id: true } });
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });

  const actorId = await resolveActorId((session.user as { id?: string }).id);
  const created = await prisma.taskComment.create({
    data: {
      taskId: id,
      actorId,
      body: text.slice(0, 4000),
    },
    include: { actor: { select: { id: true, name: true } } },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await params;
  const commentId = req.nextUrl.searchParams.get("id");
  if (!commentId) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.taskComment.deleteMany({ where: { id: commentId, taskId: id } });
  return NextResponse.json({ ok: true });
}
