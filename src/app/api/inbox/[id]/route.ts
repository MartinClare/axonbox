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

  const data: Record<string, unknown> = {};
  if (body.status) data.status = body.status;
  if (body.subject !== undefined) data.subject = body.subject;
  if (body.body !== undefined) data.body = body.body;

  const message = await prisma.inboxMessage.update({ where: { id }, data });
  return NextResponse.json(message);
}
