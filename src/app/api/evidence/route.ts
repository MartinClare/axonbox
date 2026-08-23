import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { saveUpload } from "@/lib/upload";
import { extractFromInput } from "@/lib/ai";
import { importWhatsAppMessages } from "@/lib/connectors/whatsapp";
import { importEmailMessages } from "@/lib/connectors/email";
import { clampHeading, latLngFromExif, parseGeoField } from "@/lib/capture-geo";
import type { Prisma } from "@prisma/client";
import exifr from "exifr";

function parseTagsJson(raw: unknown): string {
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const tags = parsed
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.replace(/^#/, "").trim())
          .filter(Boolean);
        return JSON.stringify([...new Set(tags)].slice(0, 20));
      }
    } catch {
      /* fall through */
    }
  }
  return "[]";
}

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const sp = req.nextUrl.searchParams;

  if (sp.get("suggestTags") === "1") {
    const rows = await prisma.evidence.findMany({
      where: { tagsJson: { not: "[]" } },
      select: { tagsJson: true },
      orderBy: { capturedAt: "desc" },
      take: 80,
    });
    const counts = new Map<string, number>();
    for (const row of rows) {
      try {
        const tags = JSON.parse(row.tagsJson) as unknown;
        if (!Array.isArray(tags)) continue;
        for (const t of tags) {
          if (typeof t !== "string" || !t.trim()) continue;
          const key = t.replace(/^#/, "").trim();
          counts.set(key, (counts.get(key) || 0) + 1);
        }
      } catch {
        /* ignore */
      }
    }
    const tags = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t)
      .slice(0, 20);
    return NextResponse.json({ tags });
  }

  const q = sp.get("q") || undefined;
  const category = sp.get("category") || undefined;
  const status = sp.get("status") || undefined;
  const source = sp.get("source") || undefined;
  const linked = sp.get("linked");
  const sortRaw = sp.get("sort") || "capturedAt";
  const sortField = sortRaw === "createdAt" ? "createdAt" : "capturedAt";
  const orderRaw = (sp.get("order") || "desc").toLowerCase();
  const orderDir = orderRaw === "asc" ? "asc" : "desc";
  const page = Math.max(1, Number(sp.get("page") || 1));
  const pageSize = Math.min(96, Number(sp.get("pageSize") || 36));
  const withEvents = sp.get("events") === "1";

  const where: Prisma.EvidenceWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { title: { contains: q } },
              { location: { contains: q } },
              { chatText: { contains: q } },
              { tagsJson: { contains: q } },
            ],
          }
        : {},
      category ? { category } : {},
      status ? { status } : {},
      source ? { source } : {},
      linked === "1" ? { caseId: { not: null } } : linked === "0" ? { caseId: null } : {},
    ],
  };

  const [total, items] = await Promise.all([
    prisma.evidence.count({ where }),
    prisma.evidence.findMany({
      where,
      orderBy: { [sortField]: orderDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        case: withEvents
          ? {
              include: {
                events: { include: { actor: true }, orderBy: { createdAt: "asc" } },
              },
            }
          : {
              select: { id: true, caseNo: true, status: true, title: true },
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
    const tagsJson = parseTagsJson(form.get("tagsJson"));
    const skipAi = String(form.get("skipAi") || "") === "1";
    const providedAiJson = String(form.get("aiJson") || "").trim() || undefined;
    const file = form.get("file");
    let clientLat = parseGeoField(form.get("lat"));
    let clientLng = parseGeoField(form.get("lng"));
    let clientHeading = clampHeading(parseGeoField(form.get("headingDeg")));
    let filePath: string | undefined;
    let mime: string | undefined;
    let exifJson: string | undefined;
    let type: "PHOTO" | "VOICE" | "CHAT" | "DOC" = chatText ? "CHAT" : "DOC";
    let aiJson: string | undefined = providedAiJson;
    let category: string | undefined;
    let severity: string | undefined;
    let location: string | undefined;
    let finalTitle = title;

    if (providedAiJson) {
      try {
        const ai = JSON.parse(providedAiJson) as {
          category?: string;
          severity?: string;
          location?: string;
          title?: string;
        };
        category = ai.category;
        severity = ai.severity;
        location = ai.location;
        if (!title && ai.title) finalTitle = ai.title;
      } catch {
        /* ignore */
      }
    }

    if (file instanceof File && file.size > 0) {
      const saved = await saveUpload(file, "evidence");
      filePath = saved.filePath;
      mime = saved.mime;
      if (file.type.startsWith("image/") || isImageName(file.name)) {
        type = "PHOTO";
        try {
          const exif = await exifr.parse(saved.bytes);
          if (exif) {
            exifJson = JSON.stringify(exif);
            if (clientLat == null || clientLng == null) {
              const fromExif = latLngFromExif(exif as Record<string, unknown>);
              if (clientLat == null) clientLat = fromExif.lat;
              if (clientLng == null) clientLng = fromExif.lng;
            }
          }
        } catch {
          /* ignore */
        }
        if (!skipAi && !providedAiJson) {
          const ai = await extractFromInput({
            text: chatText || title,
            imageBase64: saved.bytes.toString("base64"),
            imageMime: file.type || "image/jpeg",
            filename: file.name,
            analysisMode: "discover",
          });
          aiJson = JSON.stringify(ai);
          category = ai.category;
          severity = ai.severity;
          location = ai.location;
          finalTitle = title || ai.title;
        } else {
          finalTitle = title || file.name;
        }
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
      if (!skipAi && !providedAiJson) {
        const ai = await extractFromInput({ text: chatText, analysisMode: "discover" });
        aiJson = JSON.stringify(ai);
        category = ai.category;
        severity = ai.severity;
        location = ai.location;
        if (!title) finalTitle = ai.title;
      }
    }

    const created = await prisma.evidence.create({
      data: {
        type,
        title: finalTitle || "未命名證據",
        location,
        filePath,
        mime,
        lat: clientLat,
        lng: clientLng,
        headingDeg: clientHeading,
        exifJson,
        aiJson,
        chatText: chatText || null,
        tagsJson,
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

function isImageName(name: string) {
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name);
}
