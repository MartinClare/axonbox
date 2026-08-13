import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const rows = await prisma.subcontractor.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { cases: true } },
    },
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const name = String(body.name || "").trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const project = await prisma.project.findFirst();
  const row = await prisma.subcontractor.create({
    data: {
      name,
      contact: body.contact?.trim() || null,
      phone: body.phone?.trim() || null,
      email: body.email?.trim() || null,
      trade: body.trade?.trim() || null,
      address: body.address?.trim() || null,
      licenseNo: body.licenseNo?.trim() || null,
      notes: body.notes?.trim() || null,
      projectId: project?.id,
      userId: body.userId || null,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      _count: { select: { cases: true } },
    },
  });

  return NextResponse.json(row, { status: 201 });
}
