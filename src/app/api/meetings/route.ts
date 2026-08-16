import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { extractMeetingActions, normalizeMinutesOutputLang } from "@/lib/ai";
import {
  extractMinutesText,
  isMinutesFile,
  matchAssigneeByName,
  MINUTES_MAX_BYTES,
  type DirectoryUser,
} from "@/lib/minutes";

export const maxDuration = 120;

const meetingInclude = {
  tasks: {
    where: { archived: false },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    include: {
      assignee: { select: { id: true, name: true, email: true } },
    },
  },
  _count: { select: { tasks: true } },
};

type ConfirmAction = {
  title?: string;
  assigneeName?: string | null;
  assigneeId?: string | null;
  dueAt?: string | null;
  notes?: string | null;
};

function parseDue(v?: string | null) {
  if (!v) return null;
  const s = String(v);
  return new Date(s.length === 10 ? `${s}T12:00:00` : s);
}

async function buildPreview(buf: Buffer, fileName: string, mime: string) {
  if (buf.length > MINUTES_MAX_BYTES) {
    return NextResponse.json(
      { error: `檔案過大（上限 ${Math.floor(MINUTES_MAX_BYTES / 1_000_000)}MB）` },
      { status: 400 },
    );
  }
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

  const extracted = await extractMeetingActions(rawText);
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
    mock: extracted.mock,
    model: extracted.model || null,
  });
}

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const meetings = await prisma.meeting.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: meetingInclude,
  });
  return NextResponse.json(meetings);
}

export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const project = await prisma.project.findFirst();
  if (!project) {
    return NextResponse.json({ error: "No project" }, { status: 400 });
  }

  const contentType = req.headers.get("content-type") || "";

  // Multipart upload — avoids base64 JSON hitting ~10MB body limits
  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File) || file.size <= 0) {
        return NextResponse.json({ error: "file required" }, { status: 400 });
      }
      const fileName =
        String(form.get("fileName") || "").trim() || file.name || "minutes.bin";
      const mime = String(form.get("mime") || file.type || "");
      const buf = Buffer.from(await file.arrayBuffer());
      return await buildPreview(buf, fileName, mime);
    } catch (e) {
      console.error("[meetings.POST multipart]", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "upload failed" },
        { status: 500 },
      );
    }
  }

  if (contentType.includes("application/json")) {
    try {
      const raw = await req.text();
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch (parseErr) {
        const msg = parseErr instanceof Error ? parseErr.message : "";
        if (/Unterminated string|Unexpected end/i.test(msg)) {
          return NextResponse.json(
            {
              error:
                "上傳方式已更新。請強制重新整理頁面（Cmd+Shift+R / Ctrl+Shift+R）後再試；檔案請保持 10MB 以下。",
            },
            { status: 413 },
          );
        }
        throw parseErr;
      }

      // Old base64 clients — force refresh onto binary /api/meetings/preview
      if (body.fileBase64 || (body.preview === true && !body.confirm && !body.rawText)) {
        return NextResponse.json(
          {
            error:
              "上傳方式已更新。請強制重新整理頁面（Cmd+Shift+R / Ctrl+Shift+R）後再上傳會議紀錄。",
          },
          { status: 409 },
        );
      }

      // Optional: text-only preview (tiny payload)
      if (body.preview === true && typeof body.rawText === "string") {
        const fileName = String(body.fileName || body.name || "minutes.txt");
        const rawText = String(body.rawText);
        const outputLang = normalizeMinutesOutputLang(body.outputLang);
        if (!rawText.trim()) {
          return NextResponse.json({ error: "內容為空" }, { status: 400 });
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
          rawText: rawText.slice(0, 20_000),
          actions,
          outputLang,
          mock: extracted.mock,
          model: extracted.model || null,
        });
      }

      // Confirm → create meeting + tasks
      if (!body.confirm) {
        return NextResponse.json({ error: "confirm required" }, { status: 400 });
      }

      const title = String(body.title || "").trim() || "會議行動項目";
      const sourceName = body.sourceName ? String(body.sourceName) : null;
      const rawText = body.rawText ? String(body.rawText) : null;
      const meetingAt = body.meetingAt ? parseDue(String(body.meetingAt)) : null;
      const actions = (Array.isArray(body.actions) ? body.actions : []) as ConfirmAction[];
      if (actions.length === 0) {
        return NextResponse.json({ error: "至少需要一項行動" }, { status: 400 });
      }

      const maxOrder = await prisma.meeting.aggregate({ _max: { sortOrder: true } });
      const meeting = await prisma.meeting.create({
        data: {
          title,
          meetingAt,
          sourceName,
          rawText,
          projectId: project.id,
          sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        },
      });

      const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, company: true },
      });
      const userIds = new Set(users.map((u) => u.id));

      await prisma.$transaction(
        actions.map((a, i) => {
          const actionTitle = String(a.title || "").trim();
          let assigneeId =
            a.assigneeId && userIds.has(String(a.assigneeId))
              ? String(a.assigneeId)
              : null;
          if (!assigneeId && a.assigneeName) {
            assigneeId = matchAssigneeByName(a.assigneeName, users)?.id || null;
          }
          const notes = a.notes ? String(a.notes).trim() : "";
          const unmatched =
            !assigneeId && a.assigneeName ? `負責人：${a.assigneeName}` : "";
          const instructions = [notes, unmatched].filter(Boolean).join("\n") || null;

          return prisma.task.create({
            data: {
              title: actionTitle || `行動 ${i + 1}`,
              instructions,
              status: "PENDING",
              meetingId: meeting.id,
              caseId: null,
              assigneeId,
              dueAt: parseDue(a.dueAt || null),
              sortOrder: i,
              labelsJson: JSON.stringify(["purple"]),
              coverColor: "purple",
            },
          });
        }),
      );

      const full = await prisma.meeting.findUnique({
        where: { id: meeting.id },
        include: meetingInclude,
      });
      return NextResponse.json(full, { status: 201 });
    } catch (e) {
      console.error("[meetings.POST]", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "request failed" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { error: "請以 multipart 上傳檔案，或以 JSON confirm" },
    { status: 400 },
  );
}
