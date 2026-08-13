import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { saveUpload } from "@/lib/upload";
import { extractFromInput } from "@/lib/ai";
import { importWhatsAppMessages } from "@/lib/connectors/whatsapp";
import { importEmailMessages } from "@/lib/connectors/email";
import type { Prisma } from "@prisma/client";
import exifr from "exifr";

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") || undefined;
  const category = sp.get("category") || undefined;
  const status = sp.get("status") || undefined;
  const source = sp.get("source") || undefined;
  const page = Math.max(1, Number(sp.get("page") || 1));
  const pageSize = Math.min(48, Number(sp.get("pageSize") || 16));

  const where: Prisma.EvidenceWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { title: { contains: q } },
              { location: { contains: q } },
              { chatText: { contains: q } },
            ],
          }
        : {},
      category ? { category } : {},
      status ? { status } : {},
      source ? { source } : {},
    ],
  };

  const [total, items] = await Promise.all([
    prisma.evidence.count({ where }),
    prisma.evidence.findMany({
      where,
      orderBy: { capturedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        case: {
          include: {
            events: { include: { actor: true }, orderBy: { createdAt: "asc" } },
          },
        },
      },
    }),
  ]);

  const counts = {
    upload: await prisma.evidence.count({ where: { source: "UPLOAD" } }),
    whatsapp: await prisma.evidence.count({ where: { source: "WHATSAPP_IMPORT" } }),
    email: await prisma.evidence.count({ where: { source: "EMAIL_IMPORT" } }),
    folder: await prisma.evidence.count({ where: { source: "FOLDER" } }),
  };

  return NextResponse.json({ total, page, pageSize, items, counts });
}

export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const project = await prisma.project.findFirst();
  if (!project) return NextResponse.json({ error: "No project" }, { status: 400 });

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const source = String(form.get("source") || "UPLOAD") as
      | "UPLOAD"
      | "WHATSAPP_IMPORT"
      | "EMAIL_IMPORT"
      | "FOLDER";
    const chatText = String(form.get("chatText") || "");
    const title = String(form.get("title") || "");
    const file = form.get("file");
    let filePath: string | undefined;
    let mime: string | undefined;
    let exifJson: string | undefined;
    let type: "PHOTO" | "VOICE" | "CHAT" | "DOC" = chatText ? "CHAT" : "DOC";
    let aiJson: string | undefined;
    let category: string | undefined;
    let severity: string | undefined;
    let location: string | undefined;
    let finalTitle = title;

    if (file instanceof File && file.size > 0) {
      const saved = await saveUpload(file, "evidence");
      filePath = saved.filePath;
      mime = saved.mime;
      if (file.type.startsWith("image/")) {
        type = "PHOTO";
        try {
          const exif = await exifr.parse(saved.bytes);
          if (exif) exifJson = JSON.stringify(exif);
        } catch {
          /* ignore */
        }
        const ai = await extractFromInput({
          text: chatText || title,
          imageBase64: saved.bytes.toString("base64"),
          imageMime: file.type,
          filename: file.name,
        });
        aiJson = JSON.stringify(ai);
        category = ai.category;
        severity = ai.severity;
        location = ai.location;
        finalTitle = title || ai.title;
      } else if (file.type.startsWith("audio/")) {
        type = "VOICE";
        finalTitle = title || `語音 ${file.name}`;
      } else {
        type = "DOC";
        finalTitle = title || file.name;
      }
    } else if (chatText) {
      type = "CHAT";
      if (source === "WHATSAPP_IMPORT") {
        const msgs = await importWhatsAppMessages(chatText);
        finalTitle = title || `WhatsApp 匯入（${msgs.length} 則）`;
      } else if (source === "EMAIL_IMPORT") {
        const emails = await importEmailMessages({ body: chatText });
        finalTitle = title || emails[0].subject;
      } else {
        finalTitle = title || "聊天記錄";
      }
      const ai = await extractFromInput({ text: chatText });
      aiJson = JSON.stringify(ai);
      category = ai.category;
      severity = ai.severity;
      location = ai.location;
      if (!title) finalTitle = ai.title;
    }

    const created = await prisma.evidence.create({
      data: {
        type,
        title: finalTitle || "未命名證據",
        location,
        filePath,
        mime,
        exifJson,
        aiJson,
        chatText: chatText || null,
        source,
        category,
        severity,
        projectId: project.id,
        status: "PENDING",
      },
    });
    return NextResponse.json(created, { status: 201 });
  }

  return NextResponse.json({ error: "multipart required" }, { status: 400 });
}
