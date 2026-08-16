import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { extractMeetingActions, normalizeMinutesOutputLang } from "@/lib/ai";
import {
  extractMinutesText,
  isMinutesFile,
  matchAssigneeByName,
  MINUTES_MAX_BYTES,
  type DirectoryUser,
} from "@/lib/minutes";
import { prisma } from "@/lib/prisma";

export const maxDuration = 120;

function decodeFileName(header: string | null) {
  if (!header) return "minutes.bin";
  try {
    const b64 = header.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(b64, "base64").toString("utf8") || "minutes.bin";
  } catch {
    try {
      return decodeURIComponent(header);
    } catch {
      return "minutes.bin";
    }
  }
}

/**
 * POST raw file bytes (Content-Type = file mime).
 * Headers: X-File-Name (base64 utf-8), X-File-Mime (optional), X-Output-Lang (original|zh|en)
 */
export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const buf = Buffer.from(await req.arrayBuffer());
    if (!buf.length) {
      return NextResponse.json({ error: "empty body" }, { status: 400 });
    }
    if (buf.length > MINUTES_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `檔案過大（${(buf.length / 1_000_000).toFixed(1)}MB）。請壓縮至 ${Math.floor(MINUTES_MAX_BYTES / 1_000_000)}MB 以下。`,
        },
        { status: 413 },
      );
    }

    const fileName = decodeFileName(req.headers.get("x-file-name"));
    const mime =
      req.headers.get("x-file-mime") ||
      req.headers.get("content-type") ||
      "";
    const outputLang = normalizeMinutesOutputLang(req.headers.get("x-output-lang"));

    const meta = { name: fileName, mime };
    if (!isMinutesFile(meta)) {
      return NextResponse.json({ error: "請上傳 PDF、Word 或文字檔" }, { status: 400 });
    }

    const rawText = await extractMinutesText(buf, meta);
    if (!rawText.trim()) {
      return NextResponse.json(
        { error: "無法讀取檔案內容（舊版 .doc 請轉成 .docx 或 PDF）" },
        { status: 400 },
      );
    }

    const extracted = await extractMeetingActions(rawText, { outputLang });
    const users = (await prisma.user.findMany({
      select: { id: true, name: true, email: true, company: true },
    })) as DirectoryUser[];

    const actions = extracted.actions.map((a) => {
      const matched = matchAssigneeByName(a.assigneeName, users);
      return {
        title: a.title,
        assigneeName: a.assigneeName,
        assigneeId: matched?.id || null,
        matchedName: matched?.name || null,
        dueAt: a.dueAt,
        notes: a.notes,
      };
    });

    return NextResponse.json({
      preview: true,
      title: extracted.title,
      meetingAt: extracted.meetingAt,
      sourceName: fileName,
      rawText,
      actions,
      outputLang,
      mock: extracted.mock,
      model: extracted.model || null,
    });
  } catch (e) {
    console.error("[meetings.preview]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "preview failed" },
      { status: 500 },
    );
  }
}
