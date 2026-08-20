import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { saveUpload } from "@/lib/upload";

const MAX_BYTES = 12_000_000;
const MAX_FILES = 50;

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, _count: { select: { attachments: true } } },
  });
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (task._count.attachments >= MAX_FILES) {
    return NextResponse.json({ error: "too many attachments" }, { status: 400 });
  }

  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const body = (await req.json()) as { url?: string; name?: string };
    const url = String(body.url || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }
    const created = await prisma.taskAttachment.create({
      data: {
        taskId: id,
        name: String(body.name || url).slice(0, 180),
        url,
      },
    });
    return NextResponse.json(created, { status: 201 });
  }

  const form = await req.formData();
  const files = form
    .getAll("file")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (task._count.attachments + files.length > MAX_FILES) {
    return NextResponse.json({ error: "too many attachments" }, { status: 400 });
  }
  if (files.some((f) => f.size > MAX_BYTES)) {
    return NextResponse.json({ error: "file too large" }, { status: 400 });
  }

  let hasCover = Boolean(
    await prisma.taskAttachment.findFirst({
      where: { taskId: id, isCover: true },
      select: { id: true },
    }),
  );
  const created = [];
  for (const file of files) {
    const saved = await saveUpload(file, "tasks");
    const image =
      (saved.mime || "").startsWith("image/") || /\.(jpe?g|png|gif|webp)$/i.test(file.name);
    const isCover = image && !hasCover;
    if (isCover) hasCover = true;
    created.push(
      await prisma.taskAttachment.create({
        data: {
          taskId: id,
          name: saved.originalName || file.name,
          filePath: saved.filePath,
          mime: saved.mime,
          size: file.size,
          isCover,
        },
      }),
    );
  }
  return NextResponse.json({ attachments: created }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await params;
  const body = (await req.json()) as { id?: string; isCover?: boolean };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const att = await prisma.taskAttachment.findFirst({
    where: { id: body.id, taskId: id },
  });
  if (!att) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (body.isCover) {
    await prisma.taskAttachment.updateMany({
      where: { taskId: id },
      data: { isCover: false },
    });
  }
  const updated = await prisma.taskAttachment.update({
    where: { id: att.id },
    data: { isCover: Boolean(body.isCover) },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await params;
  const attId = req.nextUrl.searchParams.get("id");
  if (!attId) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.taskAttachment.deleteMany({ where: { id: attId, taskId: id } });
  return NextResponse.json({ ok: true });
}
