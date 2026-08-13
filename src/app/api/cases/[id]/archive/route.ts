import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import JSZip from "jszip";
import { readFile } from "fs/promises";
import path from "path";
import { saveBuffer } from "@/lib/upload";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { error } = await requireSession();
  if (error) return error;
  const { id: caseId } = await ctx.params;
  if (!caseId) return NextResponse.json({ error: "caseId required" }, { status: 400 });

  const item = await prisma.case.findUnique({
    where: { id: caseId },
    include: { evidence: true, events: true },
  });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const zip = new JSZip();
  zip.file(
    "case.json",
    JSON.stringify(
      {
        caseNo: item.caseNo,
        title: item.title,
        description: item.description,
        status: item.status,
        location: item.location,
        events: item.events,
      },
      null,
      2
    )
  );

  for (const e of item.evidence) {
    if (e.filePath) {
      try {
        const abs = path.join(process.cwd(), "public", e.filePath.replace(/^\//, ""));
        const buf = await readFile(abs);
        zip.file(path.basename(e.filePath), buf);
      } catch {
        /* skip missing */
      }
    }
    if (e.chatText) {
      zip.file(`chat-${e.id}.txt`, e.chatText);
    }
  }

  const content = await zip.generateAsync({ type: "nodebuffer" });
  const filename = `${item.caseNo}-archive.zip`;
  await saveBuffer(
    Buffer.from(content),
    filename,
    "exports",
    "application/zip"
  );
  return NextResponse.json({ filePath: `/api/files/exports/${filename}` });
}
