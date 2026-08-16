import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { ensureUserInboundKey, inboundAddressForKey } from "@/lib/inbound-key";
import {
  analyzeInboxMessage,
  ingestAndPropose,
  ingestPaste,
  listConnectorStatus,
  persistNormalizedMessages,
} from "@/lib/inbox";
import type { InboxChannel, NormalizedInboxMessage } from "@/lib/connectors";
import {
  getInboundAddress,
  inboundDomain,
  inboundImapConfigured,
  inboundResendConfigured,
  inboundWebhookConfigured,
  mailboxAlias,
} from "@/lib/email-inbound";

function mailboxFromRaw(rawPayload?: string | null) {
  if (!rawPayload) return "";
  try {
    const raw = JSON.parse(rawPayload) as { mailbox?: string; to?: string; receivedFor?: string };
    return raw.mailbox || mailboxAlias(raw.to || raw.receivedFor);
  } catch {
    return "";
  }
}

function fromFromRaw(rawPayload?: string | null) {
  if (!rawPayload) return "";
  try {
    const raw = JSON.parse(rawPayload) as { from?: string };
    return raw.from || "";
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const status = req.nextUrl.searchParams.get("status") || undefined;
  const channel = req.nextUrl.searchParams.get("channel") || undefined;
  const userId = (session.user as { id?: string }).id;
  const me = userId ? await ensureUserInboundKey(userId) : null;

  const [messages, counts, connectors, org] = await Promise.all([
    prisma.inboxMessage.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(channel ? { channel } : {}),
      },
      orderBy: { receivedAt: "desc" },
      include: {
        case: { select: { id: true, caseNo: true, title: true, status: true } },
        forwardedBy: { select: { id: true, name: true, inboundKey: true } },
      },
      take: 100,
    }),
    prisma.inboxMessage.groupBy({
      by: ["status"],
      _count: true,
    }),
    Promise.resolve(listConnectorStatus()),
    prisma.orgSettings.findFirst(),
  ]);

  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count]));

  const address = getInboundAddress(org?.inboundEmail) || null;
  const myAddress =
    (me?.inboundKey && inboundAddressForKey(me.inboundKey, org?.inboundEmail)) ||
    address;

  return NextResponse.json({
    messages: messages.map((m) => ({
      ...m,
      mailbox: mailboxFromRaw(m.rawPayload) || m.forwardedBy?.inboundKey || "",
      forwardedByName: m.forwardedBy?.name || null,
      fromEmail: fromFromRaw(m.rawPayload),
    })),
    counts: {
      pending: countMap.PENDING || 0,
      analyzed: countMap.ANALYZED || 0,
      processed: countMap.PROCESSED || 0,
      dismissed: countMap.DISMISSED || 0,
    },
    connectors,
    inbound: {
      address: myAddress,
      domain: inboundDomain(address) || null,
      key: me?.inboundKey || null,
      webhookConfigured: inboundWebhookConfigured(),
      imapConfigured: inboundImapConfigured(),
      resendConfigured: inboundResendConfigured(),
      webhookPath: "/api/connectors/email/webhook",
    },
  });
}

function parseIds(body: { ids?: unknown }) {
  if (!Array.isArray(body.ids)) return [];
  return [...new Set(body.ids.filter((id): id is string => typeof id === "string" && id.length > 0))];
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const body = (await req.json()) as { action?: string; ids?: unknown };
  const ids = parseIds(body);
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  if (body.action === "restore") {
    const messages = await prisma.inboxMessage.findMany({
      where: { id: { in: ids }, status: "DISMISSED" },
      select: { id: true, aiJson: true },
    });
    if (messages.length === 0) {
      return NextResponse.json({ ok: true, restored: 0 });
    }
    await prisma.$transaction(
      messages.map((m) =>
        prisma.inboxMessage.update({
          where: { id: m.id },
          data: {
            status: m.aiJson ? "ANALYZED" : "PENDING",
            processedAt: null,
          },
        }),
      ),
    );
    return NextResponse.json({ ok: true, restored: messages.length });
  }

  if (body.action === "delete") {
    const result = await prisma.inboxMessage.deleteMany({
      where: { id: { in: ids }, status: "DISMISSED" },
    });
    return NextResponse.json({ ok: true, deleted: result.count });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
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

  const analyze = body.analyze !== false;

  if (channel === "MANUAL") {
    const rows = [
      {
        channel: "MANUAL" as const,
        sender: body.sender || "現場錄入",
        subject: body.subject,
        body: body.body || body.text || "",
        receivedAt: new Date(),
      },
    ];
    if (analyze) {
      const proposed = await ingestAndPropose(project.id, rows);
      return NextResponse.json(
        { created: proposed.map((p) => p.message), count: proposed.length, proposed },
        { status: 201 },
      );
    }
    const created = await persistNormalizedMessages(project.id, rows);
    return NextResponse.json({ created, count: created.length }, { status: 201 });
  }

  const created = await ingestPaste({
    projectId: project.id,
    channel,
    input,
  });
  if (!analyze) {
    return NextResponse.json({ created, count: created.length }, { status: 201 });
  }

  const proposed = [];
  for (const row of created) {
    try {
      proposed.push(await analyzeInboxMessage(row.id));
    } catch {
      proposed.push({ message: row, extract: null });
    }
  }
  return NextResponse.json(
    { created: proposed.map((p) => p.message), count: proposed.length, proposed },
    { status: 201 },
  );
}
