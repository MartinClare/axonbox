import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { extractMeetingActions } from "@/lib/ai";
import {
  extractMinutesText,
  isMinutesFile,
  matchAssigneeByName,
  MINUTES_MAX_BYTES,
  type DirectoryUser,
} from "@/lib/minutes";

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

  // Step 1: upload file → preview (no DB write)
  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file required" }, { status: 400 });
      }
      if (file.size > MINUTES_MAX_BYTES) {
        return NextResponse.json({ error: "file too large" }, { status: 400 });
      }
      const meta = { name: file.name, mime: file.type || "" };
      if (!isMinutesFile(meta)) {
        return NextResponse.json(
          { error: "請上傳 PDF、Word 或文字檔" },
          { status: 400 },
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
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
        sourceName: file.name,
        rawText,
        actions,
        mock: extracted.mock,
        model: extracted.model || null,
      });
    } catch (e) {
      console.error("[meetings.POST upload]", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "upload failed" },
        { status: 500 },
      );
    }
  }

  // Step 2: confirm → create meeting + tasks
  try {
    const body = await req.json();
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
    console.error("[meetings.POST confirm]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "create failed" },
      { status: 500 },
    );
  }
}
