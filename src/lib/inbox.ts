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
import { mailboxAlias } from "@/lib/email-inbound";
import { resolveUserByMailbox } from "@/lib/inbound-key";
import {
  emailIsThin,
  emailRefersToAttachment,
  excerptFromDocument,
  evidenceTypeFor,
  isDocumentFile,
  isImageFile,
  parseInboxAttachments,
} from "@/lib/inbound-files";
import { saveBuffer } from "@/lib/upload";
import { randomUUID } from "crypto";
import path from "path";

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
    if (!m.body?.trim() && !m.subject?.trim() && !(m.attachments || []).length) continue;
    if (m.externalId) {
      const existing = await prisma.inboxMessage.findFirst({
        where: { externalId: m.externalId, channel: m.channel },
      });
      if (existing) {
        created.push(existing);
        continue;
      }
    }
    const raw =
      m.rawPayload && typeof m.rawPayload === "object"
        ? (m.rawPayload as Record<string, unknown>)
        : {};
    const mailbox = String(raw.mailbox || mailboxAlias(String(raw.to || "")) || "");
    const forwardedBy = await resolveUserByMailbox(mailbox || String(raw.to || ""));
    if (m.channel === "EMAIL" && !forwardedBy) {
      console.warn("[inbox] reject unknown mailbox", mailbox || raw.to || "(empty)");
      continue;
    }
    const row = await prisma.inboxMessage.create({
      data: {
        channel: m.channel,
        externalId: m.externalId,
        sender: forwardedBy?.name || m.sender,
        subject: m.subject || null,
        body: m.body || "",
        rawPayload: JSON.stringify({
          ...raw,
          from: m.sender,
          mailbox: raw.mailbox || mailboxAlias(String(raw.to || "")),
          forwardedByUserId: forwardedBy?.id || null,
          forwardedByName: forwardedBy?.name || null,
        }),
        attachments: JSON.stringify(m.attachments || []),
        receivedAt: m.receivedAt || new Date(),
        projectId,
        forwardedByUserId: forwardedBy?.id || null,
        status: "PENDING",
      },
    });
    created.push(row);
  }
  return created;
}

/** Persist inbound mail and run LLM → proposed case (no task until approved). */
export async function ingestAndPropose(
  projectId: string,
  messages: NormalizedInboxMessage[],
) {
  const created = await persistNormalizedMessages(projectId, messages);
  const proposed = [];
  for (const row of created) {
    if (row.status === "PROCESSED" || row.status === "DISMISSED") {
      proposed.push({ message: row, extract: row.aiJson ? JSON.parse(row.aiJson) : null });
      continue;
    }
    if (row.status === "ANALYZED" && row.aiJson) {
      proposed.push({ message: row, extract: JSON.parse(row.aiJson) });
      continue;
    }
    try {
      proposed.push(await analyzeInboxMessage(row.id));
    } catch (err) {
      console.error("inbox propose failed", err);
      proposed.push({ message: row, extract: null });
    }
  }
  return proposed;
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
  const files = parseInboxAttachments(message.attachments);
  const photo = files.find(isImageFile);
  const docs = files.filter(isDocumentFile);

  let imageBase64 = opts?.imageBase64;
  let imageMime = opts?.imageMime || "image/jpeg";
  if (!imageBase64 && photo) {
    imageBase64 = photo.base64;
    imageMime = photo.mime || imageMime;
  }

  let extract = await extractFromInput({
    text,
    imageBase64,
    imageMime,
    filename: `${message.channel}-${message.sender}`,
    mode: message.channel === "EMAIL" ? "email" : "site",
  });

  const needDoc =
    message.channel === "EMAIL" &&
    docs.length > 0 &&
    (emailIsThin(text) ||
      emailRefersToAttachment(text) ||
      extract.confidence < 0.45 ||
      extract.mock);

  if (needDoc) {
    const excerpts: string[] = [];
    for (const doc of docs.slice(0, 2)) {
      const buf = Buffer.from(doc.base64, "base64");
      const excerpt = await excerptFromDocument(buf, doc);
      if (excerpt) excerpts.push(`【${doc.name}】\n${excerpt}`);
    }
    if (excerpts.length) {
      extract = await extractFromInput({
        text,
        imageBase64,
        imageMime,
        filename: `${message.channel}-${message.sender}`,
        mode: "email",
        documentNote: excerpts.join("\n\n"),
      });
    }
  }

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
      sourceType: message.channel === "EMAIL" ? "EMAIL" : "CHAT",
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
      note: `由${message.channel}收件核准後建立事件與任務`,
      actorId,
    },
  });

  await prisma.evidence.update({
    where: { id: evidence.id },
    data: { caseId: created.id },
  });

  const files = parseInboxAttachments(message.attachments);
  for (const file of files) {
    try {
      const ext = path.extname(file.name) || "";
      const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext || ""}`;
      const saved = await saveBuffer(
        Buffer.from(file.base64, "base64"),
        filename,
        "evidence",
        file.mime,
      );
      await prisma.evidence.create({
        data: {
          type: evidenceTypeFor(file),
          title: file.name,
          filePath: saved.filePath,
          mime: file.mime,
          source: evidenceSource(message.channel),
          status: "IN_PROGRESS",
          category: extract.category,
          severity: extract.severity,
          projectId: message.projectId,
          caseId: created.id,
        },
      });
    } catch (err) {
      console.error("[inbox] attach file failed", file.name, err);
    }
  }

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
