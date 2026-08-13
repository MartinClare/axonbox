import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  for (const key of [
    "name",
    "contact",
    "phone",
    "email",
    "trade",
    "address",
    "licenseNo",
    "notes",
  ] as const) {
    if (body[key] !== undefined) {
      data[key] = typeof body[key] === "string" ? body[key].trim() || null : body[key];
    }
  }
  if (body.userId !== undefined) {
    data.userId = body.userId || null;
  }

  try {
    const row = await prisma.subcontractor.update({
      where: { id },
      data,
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { cases: true } },
      },
    });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "update failed" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  await prisma.case.updateMany({
    where: { subcontractorId: id },
    data: { subcontractorId: null },
  });
  await prisma.subcontractor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
