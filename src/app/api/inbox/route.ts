import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import {
  ingestPaste,
  listConnectorStatus,
  persistNormalizedMessages,
} from "@/lib/inbox";
import type { InboxChannel, NormalizedInboxMessage } from "@/lib/connectors";

export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const status = req.nextUrl.searchParams.get("status") || undefined;
  const channel = req.nextUrl.searchParams.get("channel") || undefined;

  const [messages, counts, connectors] = await Promise.all([
    prisma.inboxMessage.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(channel ? { channel } : {}),
      },
      orderBy: { receivedAt: "desc" },
      include: {
        case: { select: { id: true, caseNo: true, title: true, status: true } },
      },
      take: 100,
    }),
    prisma.inboxMessage.groupBy({
      by: ["status"],
      _count: true,
    }),
    Promise.resolve(listConnectorStatus()),
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count]));

  return NextResponse.json({
    messages,
    counts: {
      pending: countMap.PENDING || 0,
      analyzed: countMap.ANALYZED || 0,
      processed: countMap.PROCESSED || 0,
      dismissed: countMap.DISMISSED || 0,
    },
    connectors,
  });
}

export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const project = await prisma.project.findFirst();
  if (!project) {
    return NextResponse.json({ error: "No project" }, { status: 400 });
  }

  const body = await req.json();
  const channel = (body.channel || "MANUAL") as InboxChannel;

  // Direct structured ingest (webhook-normalized or form)
  if (body.messages && Array.isArray(body.messages)) {
    const normalized = body.messages as NormalizedInboxMessage[];
    const created = await persistNormalizedMessages(
      project.id,
      normalized.map((m) => ({ ...m, channel: m.channel || channel })),
    );
    return NextResponse.json({ created, count: created.length }, { status: 201 });
  }

  // Paste / form import via connector adapters
  const input =
    channel === "EMAIL"
      ? {
          from: body.from || body.sender,
          subject: body.subject,
          body: body.body || body.text || "",
          attachments: body.attachments,
        }
      : body.text || body.body || "";

  if (channel === "MANUAL") {
    const created = await persistNormalizedMessages(project.id, [
      {
        channel: "MANUAL",
        sender: body.sender || "現場錄入",
        subject: body.subject,
        body: body.body || body.text || "",
        receivedAt: new Date(),
      },
    ]);
    return NextResponse.json({ created, count: created.length }, { status: 201 });
  }

  const created = await ingestPaste({
    projectId: project.id,
    channel,
    input,
  });

  return NextResponse.json({ created, count: created.length }, { status: 201 });
}
