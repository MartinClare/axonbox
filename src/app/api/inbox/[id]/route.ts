import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { analyzeInboxMessage } from "@/lib/inbox";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const message = await prisma.inboxMessage.findUnique({
    where: { id },
    include: {
      case: { include: { tasks: true } },
      evidence: true,
    },
  });
  if (!message) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(message);
}

export async function PATCH(req: Request, { params }: Params) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await params;
  const body = await req.json();

  if (body.action === "analyze") {
    try {
      const result = await analyzeInboxMessage(id, {
        imageBase64: body.imageBase64,
        imageMime: body.imageMime,
      });
      return NextResponse.json(result);
    } catch {
      return NextResponse.json({ error: "analyze failed" }, { status: 400 });
    }
  }

  if (body.action === "dismiss") {
    const message = await prisma.inboxMessage.update({
      where: { id },
      data: { status: "DISMISSED", processedAt: new Date() },
    });
    return NextResponse.json(message);
  }

  if (body.action === "restore") {
    const current = await prisma.inboxMessage.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (current.status !== "DISMISSED") {
      return NextResponse.json({ error: "only dismissed messages can be restored" }, { status: 400 });
    }
    const message = await prisma.inboxMessage.update({
      where: { id },
      data: {
        status: current.aiJson ? "ANALYZED" : "PENDING",
        processedAt: null,
      },
    });
    return NextResponse.json(message);
  }

  if (body.action === "delete") {
    const current = await prisma.inboxMessage.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (current.status !== "DISMISSED") {
      return NextResponse.json({ error: "only dismissed messages can be deleted" }, { status: 400 });
    }
    await prisma.inboxMessage.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: 1 });
  }

  const data: Record<string, unknown> = {};
  if (body.status) data.status = body.status;
  if (body.subject !== undefined) data.subject = body.subject;
  if (body.body !== undefined) data.body = body.body;

  const message = await prisma.inboxMessage.update({ where: { id }, data });
  return NextResponse.json(message);
}
