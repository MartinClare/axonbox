import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { parseInboxAttachments } from "@/lib/inbound-files";

type Params = { params: Promise<{ id: string; index: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { error } = await requireSession();
  if (error) return error;
  const { id, index } = await params;
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0) {
    return NextResponse.json({ error: "invalid index" }, { status: 400 });
  }

  const message = await prisma.inboxMessage.findUnique({
    where: { id },
    select: { attachments: true },
  });
  if (!message) return NextResponse.json({ error: "not found" }, { status: 404 });

  const files = parseInboxAttachments(message.attachments);
  const file = files[i];
  if (!file) return NextResponse.json({ error: "file not found" }, { status: 404 });

  const buf = Buffer.from(file.base64, "base64");
  const type = file.mime || "application/octet-stream";
  const inline =
    type.startsWith("image/") ||
    type.startsWith("audio/") ||
    type.startsWith("video/") ||
    type.includes("pdf");

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(file.name)}"`,
      "Cache-Control": "private, max-age=120",
    },
  });
}
