import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";

const ROLES = new Set(["OWNER", "ADMIN", "SUPERVISOR", "VIEWER", "SUBCONTRACTOR"]);

export async function GET() {
  const { error } = await requirePermission("users:read");
  if (error) return error;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      title: true,
      company: true,
      notes: true,
      createdAt: true,
      _count: { select: { assignedCases: true, assignedTasks: true } },
    },
  });
  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const { error } = await requirePermission("users:write");
  if (error) return error;

  const body = await req.json();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const role = String(body.role || "SUPERVISOR").toUpperCase();
  const password = String(body.password || "demo1234");

  if (!name || !email) {
    return NextResponse.json({ error: "name and email required" }, { status: 400 });
  }
  if (!ROLES.has(role)) {
    return NextResponse.json({ error: "invalid role" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "email already exists" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      role,
      phone: body.phone?.trim() || null,
      title: body.title?.trim() || null,
      company: body.company?.trim() || null,
      notes: body.notes?.trim() || null,
      passwordHash: await bcrypt.hash(password, 10),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      title: true,
      company: true,
      notes: true,
      createdAt: true,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
