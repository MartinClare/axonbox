import { prisma } from "@/lib/prisma";
import { extractFromInput, type ExtractResult } from "@/lib/ai";
import { nextCaseNo } from "@/lib/case-no";
import { resolveActorId } from "@/lib/session";
import {
  listConnectorStatus,
  parseIntoInbox,
  type InboxChannel,
  type NormalizedInboxMessage,
} from "@/lib/connectors";

export { listConnectorStatus };

function evidenceSource(channel: string) {
  if (channel === "WHATSAPP") return "WHATSAPP_IMPORT";
  if (channel === "EMAIL") return "EMAIL_IMPORT";
  if (channel === "WECHAT") return "WHATSAPP_IMPORT";
  return "UPLOAD";
}

export async function persistNormalizedMessages(
  projectId: string,
  messages: NormalizedInboxMessage[],
) {
  const created = [];
  for (const m of messages) {
    if (!m.body?.trim() && !m.subject?.trim()) continue;
    const row = await prisma.inboxMessage.create({
      data: {
        channel: m.channel,
        externalId: m.externalId,
        sender: m.sender,
        subject: m.subject || null,
        body: m.body || "",
        rawPayload: m.rawPayload ? JSON.stringify(m.rawPayload) : null,
        attachments: JSON.stringify(m.attachments || []),
        receivedAt: m.receivedAt || new Date(),
        projectId,
        status: "PENDING",
      },
    });
    created.push(row);
  }
  return created;
}

export async function ingestPaste(opts: {
  projectId: string;
  channel: InboxChannel;
  input: unknown;
}) {
  const messages = await parseIntoInbox(opts.channel, opts.input);
  return persistNormalizedMessages(opts.projectId, messages);
}

export async function analyzeInboxMessage(
  id: string,
  opts?: { imageBase64?: string; imageMime?: string },
): Promise<{
  message: Awaited<ReturnType<typeof prisma.inboxMessage.findUnique>>;
  extract: ExtractResult;
}> {
  const message = await prisma.inboxMessage.findUnique({ where: { id } });
  if (!message) throw new Error("not found");

  const text = [message.subject ? `主题：${message.subject}` : "", message.body]
    .filter(Boolean)
    .join("\n");

  let imageBase64 = opts?.imageBase64;
  let imageMime = opts?.imageMime || "image/jpeg";

  // Attachments may store data-URL or {base64,mime} JSON
  if (!imageBase64) {
    try {
      const atts = JSON.parse(message.attachments || "[]");
      if (Array.isArray(atts)) {
        for (const a of atts) {
          if (typeof a === "object" && a?.base64) {
            imageBase64 = String(a.base64).replace(/^data:[^;]+;base64,/, "");
            imageMime = a.mime || imageMime;
            break;
          }
          if (typeof a === "string" && a.startsWith("data:image")) {
            const m = a.match(/^data:([^;]+);base64,(.+)$/);
            if (m) {
              imageMime = m[1];
              imageBase64 = m[2];
              break;
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  const extract = await extractFromInput({
    text,
    imageBase64,
    imageMime,
    filename: `${message.channel}-${message.sender}`,
  });

  const updated = await prisma.inboxMessage.update({
    where: { id },
    data: {
      status: message.status === "PROCESSED" ? message.status : "ANALYZED",
      aiJson: JSON.stringify(extract),
    },
  });

  return { message: updated, extract };
}

export async function processInboxToEventTask(opts: {
  id: string;
  userId: string;
  assigneeId?: string;
  subcontractorId?: string;
  createTask?: boolean;
}) {
  const message = await prisma.inboxMessage.findUnique({ where: { id: opts.id } });
  if (!message) throw new Error("not found");
  if (message.status === "PROCESSED" && message.caseId) {
    const existing = await prisma.case.findUnique({
      where: { id: message.caseId },
      include: { tasks: true },
    });
    return { case: existing, extract: message.aiJson ? JSON.parse(message.aiJson) : null, reused: true };
  }

  let extract: ExtractResult;
  if (message.aiJson) {
    extract = JSON.parse(message.aiJson) as ExtractResult;
  } else {
    const analyzed = await analyzeInboxMessage(opts.id);
    extract = analyzed.extract;
  }

  const text = [message.subject ? `主题：${message.subject}` : "", message.body]
    .filter(Boolean)
    .join("\n");

  const evidence = await prisma.evidence.create({
    data: {
      type: "CHAT",
      title: extract.title || message.subject || "收件信息",
      chatText: text,
      source: evidenceSource(message.channel),
      status: "IN_PROGRESS",
      category: extract.category,
      severity: extract.severity,
      projectId: message.projectId,
      aiJson: JSON.stringify(extract),
    },
  });

  const caseNo = await nextCaseNo();
  const dueAt = new Date(Date.now() + 2 * 86400000);
  const created = await prisma.case.create({
    data: {
      caseNo,
      title: extract.title,
      description: extract.description || text,
      category: extract.category || "OTHER",
      severity: extract.severity || "MEDIUM",
      location: extract.location || "待确认",
      recommendation: extract.recommendation,
      sourceType: "CHAT",
      status: "OPEN",
      projectId: message.projectId,
      assigneeId: opts.assigneeId || opts.userId,
      subcontractorId: opts.subcontractorId || undefined,
      dueAt,
    },
  });

  const actorId = await resolveActorId(opts.userId);
  await prisma.caseEvent.create({
    data: {
      caseId: created.id,
      type: "CREATE",
      note: `由${message.channel}收件建立事件`,
      actorId,
    },
  });

  await prisma.evidence.update({
    where: { id: evidence.id },
    data: { caseId: created.id },
  });

  let task = null;
  if (opts.createTask !== false) {
    task = await prisma.task.create({
      data: {
        title: `跟進：${created.title}`,
        instructions: extract.recommendation || created.description,
        caseId: created.id,
        assigneeId:
          (await resolveActorId(opts.assigneeId || opts.userId)) || undefined,
        dueAt,
      },
    });
  }

  const updated = await prisma.inboxMessage.update({
    where: { id: opts.id },
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
      evidenceId: evidence.id,
      caseId: created.id,
      aiJson: JSON.stringify(extract),
    },
  });

  return {
    message: updated,
    case: created,
    task,
    evidence,
    extract,
    reused: false,
  };
}
