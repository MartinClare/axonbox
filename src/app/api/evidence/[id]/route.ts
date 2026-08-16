import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { ensureAfterTag, parseEvidenceTags } from "@/lib/case-closeout";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;

  const item = await prisma.evidence.findUnique({
    where: { id },
    include: {
      case: {
        include: {
          events: { include: { actor: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const existing = await prisma.evidence.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: { tagsJson?: string; title?: string; caseId?: string | null } = {};

  if (body.markAfter === true) {
    data.tagsJson = ensureAfterTag(existing.tagsJson);
  } else if (body.tagsJson !== undefined) {
    const tags =
      typeof body.tagsJson === "string"
        ? parseEvidenceTags(body.tagsJson)
        : Array.isArray(body.tagsJson)
          ? (body.tagsJson as unknown[])
              .filter((t): t is string => typeof t === "string")
              .map((t) => t.replace(/^#/, "").trim())
              .filter(Boolean)
          : [];
    data.tagsJson = JSON.stringify([...new Set(tags)].slice(0, 20));
  }

  if (typeof body.title === "string" && body.title.trim()) {
    data.title = body.title.trim();
  }
  if (body.caseId !== undefined) {
    data.caseId = body.caseId ? String(body.caseId) : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.evidence.update({
    where: { id },
    data,
    include: {
      case: {
        select: { id: true, caseNo: true, status: true, title: true },
      },
    },
  });
  return NextResponse.json(updated);
}
