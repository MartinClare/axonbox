import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { uniqueInboundKey } from "@/lib/inbound-key";

const ROLES = new Set(["OWNER", "ADMIN", "SUPERVISOR", "VIEWER", "SUBCONTRACTOR"]);

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { error } = await requirePermission("users:write");
  if (error) return error;
  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = String(body.name).trim();
  if (body.email !== undefined) data.email = String(body.email).trim().toLowerCase();
  if (body.role !== undefined) {
    const role = String(body.role).toUpperCase();
    if (!ROLES.has(role)) {
      return NextResponse.json({ error: "invalid role" }, { status: 400 });
    }
    data.role = role;
  }
  if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
  if (body.title !== undefined) data.title = body.title?.trim() || null;
  if (body.company !== undefined) data.company = body.company?.trim() || null;
  if (body.notes !== undefined) data.notes = body.notes?.trim() || null;
  if (body.regenerateInboundKey === true) {
    data.inboundKey = await uniqueInboundKey(id);
  }
  if (body.password) {
    data.passwordHash = await bcrypt.hash(String(body.password), 10);
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        title: true,
        company: true,
        notes: true,
        inboundKey: true,
        createdAt: true,
      },
    });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "update failed" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { session, error } = await requirePermission("users:write");
  if (error) return error;
  const { id } = await params;

  if ((session.user as { id?: string }).id === id) {
    return NextResponse.json({ error: "cannot delete yourself" }, { status: 400 });
  }

  const linked = await prisma.case.count({ where: { assigneeId: id } });
  if (linked > 0) {
    await prisma.case.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } });
  }
  await prisma.task.updateMany({ where: { assigneeId: id }, data: { assigneeId: null } });
  await prisma.subcontractor.updateMany({ where: { userId: id }, data: { userId: null } });

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
