import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { compactStoredFile, resolveInboxFiles } from "@/lib/inbound-files";
import { inboxFileBuffer, persistLargeInboxFile, shouldEmbedBase64 } from "@/lib/inbox-file-bytes";

export const maxDuration = 60;

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
    select: { attachments: true, rawPayload: true },
  });
  if (!message) return NextResponse.json({ error: "not found" }, { status: 404 });

  const files = resolveInboxFiles(message.attachments, message.rawPayload);
  const file = files[i];
  if (!file) return NextResponse.json({ error: "file not found" }, { status: 404 });

  const buf = await inboxFileBuffer(file);
  if (!buf) return NextResponse.json({ error: "file not found" }, { status: 404 });

  if (!file.base64 && !file.filePath) {
    try {
      const stored = shouldEmbedBase64(buf.length)
        ? compactStoredFile({ ...file, base64: buf.toString("base64") })
        : await persistLargeInboxFile(buf, file);
      files[i] = stored;
      await prisma.inboxMessage.update({
        where: { id },
        data: { attachments: JSON.stringify(files.map(compactStoredFile)) },
      });
    } catch (err) {
      console.error("[inbox] persist downloaded file failed", file.name, err);
    }
  }

  const type = sniffMime(file, buf);
  const inline =
    type.startsWith("image/") ||
    type.startsWith("audio/") ||
    type.startsWith("video/") ||
    type.includes("pdf");
  const filename = file.name.replace(/[\\"\r\n]/g, "_");

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, max-age=120",
      "Content-Length": String(buf.length),
    },
  });
}

function sniffMime(file: { name: string; mime: string }, buf: Buffer) {
  const name = (file.name || "").toLowerCase();
  const mime = (file.mime || "").toLowerCase();
  const head = buf.subarray(0, 5).toString("latin1");
  if (head.startsWith("%PDF") || name.endsWith(".pdf") || mime.includes("pdf")) {
    return "application/pdf";
  }
  if (mime && mime !== "application/octet-stream") return file.mime;
  if (/\.(jpe?g)$/.test(name)) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  return file.mime || "application/octet-stream";
}
