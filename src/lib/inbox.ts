import { prisma } from "@/lib/prisma";
import { extractFromInput, transcribeAudio, type ExtractResult } from "@/lib/ai";
import { nextCaseNo } from "@/lib/case-no";
import { resolveActorId } from "@/lib/session";
import {
  listConnectorStatus,
  parseIntoInbox,
  type InboxChannel,
  type InboxAttachment,
  type NormalizedInboxMessage,
} from "@/lib/connectors";
import {
  isWhatsAppCaseSeparator,
  normalizePhone,
  stripWhatsAppCaseSeparator,
  whatsappBundleWindowMs,
} from "@/lib/connectors/whatsapp";
import { mailboxAlias } from "@/lib/email-inbound";
import { resolveUserByMailbox } from "@/lib/inbound-key";
import {
  emailIsThin,
  emailRefersToAttachment,
  excerptFromDocument,
  evidenceTypeFor,
  isAudioFile,
  isDocumentFile,
  isImageFile,
  MAX_FILES,
  parseInboxAttachments,
} from "@/lib/inbound-files";
import { buildInboxSourcePack, withSourcePack } from "@/lib/inbox-source";
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

function extractModeForChannel(channel: string): "email" | "whatsapp" | "site" {
  if (channel === "EMAIL") return "email";
  if (channel === "WHATSAPP" || channel === "WECHAT") return "whatsapp";
  return "site";
}

async function resolveSenderByPhone(phoneRaw?: string | null) {
  const phone = normalizePhone(phoneRaw);
  if (!phone || phone.length < 6) return null;

  const users = await prisma.user.findMany({
    where: { phone: { not: null } },
    select: { id: true, name: true, phone: true },
    take: 200,
  });
  const user = users.find((u) => {
    const p = normalizePhone(u.phone);
    return p && (p === phone || p.endsWith(phone) || phone.endsWith(p));
  });
  if (user) return { id: user.id, name: user.name, kind: "user" as const };

  const subs = await prisma.subcontractor.findMany({
    where: { phone: { not: null } },
    select: { id: true, name: true, phone: true, userId: true },
    take: 200,
  });
  const sub = subs.find((s) => {
    const p = normalizePhone(s.phone);
    return p && (p === phone || p.endsWith(phone) || phone.endsWith(p));
  });
  if (sub) {
    return {
      id: sub.userId || null,
      name: sub.name,
      kind: "subcontractor" as const,
    };
  }
  return null;
}

function phoneFromMessage(m: NormalizedInboxMessage) {
  const raw =
    m.rawPayload && typeof m.rawPayload === "object"
      ? (m.rawPayload as Record<string, unknown>)
      : {};
  return normalizePhone(
    String(raw.phone || raw.from || "") || m.sender.replace(/\D/g, ""),
  );
}

function mergeAttachments(
  existingJson: string | null | undefined,
  incoming: InboxAttachment[] | undefined,
): InboxAttachment[] {
  const prev = parseInboxAttachments(existingJson).map((f) => ({
    name: f.name,
    mime: f.mime,
    base64: f.base64,
  }));
  const next = [...prev];
  for (const att of incoming || []) {
    if (next.length >= MAX_FILES) break;
    if (typeof att === "string") {
      const m = att.match(/^data:([^;]+);base64,(.+)$/);
      if (m) next.push({ name: "attachment", mime: m[1], base64: m[2] });
      continue;
    }
    if (att?.base64) {
      next.push({
        name: att.name || "attachment",
        mime: att.mime || "application/octet-stream",
        base64: String(att.base64).replace(/^data:[^;]+;base64,/, ""),
      });
    }
  }
  return next.slice(0, MAX_FILES);
}

export async function persistNormalizedMessages(
  projectId: string,
  messages: NormalizedInboxMessage[],
) {
  const created = [];
  for (const m of messages) {
    if (m.channel === "WHATSAPP") {
      const row = await persistOrBundleWhatsApp(projectId, m);
      if (row) created.push(row);
      continue;
    }
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

async function persistOrBundleWhatsApp(
  projectId: string,
  m: NormalizedInboxMessage,
) {
  if (!m.body?.trim() && !(m.attachments || []).length) return null;

  if (m.externalId) {
    const existing = await prisma.inboxMessage.findFirst({
      where: { externalId: m.externalId, channel: "WHATSAPP" },
    });
    if (existing) return existing;
  }

  const phone = phoneFromMessage(m);
  const matched = await resolveSenderByPhone(phone || m.sender);
  const displaySender = matched?.name || m.sender;
  const forwardedByUserId = matched?.id || null;

  let body = m.body || "";
  const separator = isWhatsAppCaseSeparator(body);
  if (separator) {
    body = stripWhatsAppCaseSeparator(body);
    // Separator-only with no files: still open a fresh empty-ish row only if we have attachments
    if (!body.trim() && !(m.attachments || []).length) {
      // Close current open bundle by bumping past window — create a marker? Plan says start new case.
      // Separator alone with no remainder: just force next messages into a new row by closing open ones.
      await prisma.inboxMessage.updateMany({
        where: {
          projectId,
          channel: "WHATSAPP",
          status: { in: ["PENDING", "ANALYZED"] },
          ...(phone
            ? {
                OR: [
                  { rawPayload: { contains: `"phone":"${phone}"` } },
                  { sender: displaySender },
                ],
              }
            : { sender: displaySender }),
        },
        data: { receivedAt: new Date(Date.now() - whatsappBundleWindowMs() - 1000) },
      });
      return null;
    }
  }

  const now = m.receivedAt || new Date();
  const windowStart = new Date(now.getTime() - whatsappBundleWindowMs());

  let open =
    !separator && phone
      ? await prisma.inboxMessage.findFirst({
          where: {
            projectId,
            channel: "WHATSAPP",
            status: { in: ["PENDING", "ANALYZED"] },
            receivedAt: { gte: windowStart },
            OR: [
              { rawPayload: { contains: `"phone":"${phone}"` } },
              { sender: displaySender },
            ],
          },
          orderBy: { receivedAt: "desc" },
        })
      : null;

  if (!open && !separator && !phone) {
    open = await prisma.inboxMessage.findFirst({
      where: {
        projectId,
        channel: "WHATSAPP",
        status: { in: ["PENDING", "ANALYZED"] },
        receivedAt: { gte: windowStart },
        sender: displaySender,
      },
      orderBy: { receivedAt: "desc" },
    });
  }

  const raw =
    m.rawPayload && typeof m.rawPayload === "object"
      ? (m.rawPayload as Record<string, unknown>)
      : {};

  if (open) {
    const mergedBody = [open.body, body].filter((s) => s?.trim()).join("\n");
    const attachments = mergeAttachments(open.attachments, m.attachments);
    return prisma.inboxMessage.update({
      where: { id: open.id },
      data: {
        body: mergedBody,
        attachments: JSON.stringify(attachments),
        receivedAt: now,
        status: "PENDING",
        aiJson: null,
        sender: displaySender,
        forwardedByUserId: forwardedByUserId || open.forwardedByUserId,
        rawPayload: JSON.stringify({
          ...raw,
          from: m.sender,
          phone,
          profileName: matched?.name || raw.profileName,
          forwardedByUserId,
          bundled: true,
          previousExternalIds: [
            ...((() => {
              try {
                const prev = open.rawPayload ? JSON.parse(open.rawPayload) : {};
                return Array.isArray(prev.previousExternalIds)
                  ? prev.previousExternalIds
                  : [];
              } catch {
                return [];
              }
            })()),
            open.externalId,
            m.externalId,
          ].filter(Boolean),
        }),
      },
    });
  }

  return prisma.inboxMessage.create({
    data: {
      channel: "WHATSAPP",
      externalId: m.externalId,
      sender: displaySender,
      subject: m.subject || null,
      body,
      rawPayload: JSON.stringify({
        ...raw,
        from: m.sender,
        phone,
        profileName: matched?.name || raw.profileName,
        forwardedByUserId,
        forwardedByName: matched?.name || null,
      }),
      attachments: JSON.stringify(m.attachments || []),
      receivedAt: now,
      projectId,
      forwardedByUserId,
      status: "PENDING",
    },
  });
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
    // WhatsApp bundles clear aiJson on append; email may already be ANALYZED
    if (row.channel !== "WHATSAPP" && row.status === "ANALYZED" && row.aiJson) {
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

  const files = parseInboxAttachments(message.attachments);
  const photo = files.find(isImageFile);
  const docs = files.filter(isDocumentFile);
  const audios = files.filter(isAudioFile);

  const voiceBits: string[] = [];
  for (const audio of audios.slice(0, 3)) {
    try {
      const buf = Buffer.from(audio.base64, "base64");
      const t = await transcribeAudio(buf, audio.name || "voice.ogg");
      if (t.text?.trim()) voiceBits.push(`【語音】${t.text.trim()}`);
    } catch (err) {
      console.error("[inbox] voice STT failed", err);
    }
  }

  let body = message.body || "";
  if (voiceBits.length) {
    // Avoid duplicating if already transcribed on a previous append
    const fresh = voiceBits.filter((v) => !body.includes(v));
    if (fresh.length) {
      body = [body, ...fresh].filter(Boolean).join("\n");
      await prisma.inboxMessage.update({
        where: { id },
        data: { body },
      });
    }
  }

  const text = [message.subject ? `主题：${message.subject}` : "", body]
    .filter(Boolean)
    .join("\n");

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
    mode: extractModeForChannel(message.channel),
  });

  const needDoc =
    docs.length > 0 &&
    (message.channel === "WHATSAPP" ||
      (message.channel === "EMAIL" &&
        (emailIsThin(text) ||
          emailRefersToAttachment(text) ||
          extract.confidence < 0.45 ||
          extract.mock)));

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
        mode: extractModeForChannel(message.channel),
        documentNote: excerpts.join("\n\n"),
      });
    }
  }

  const updated = await prisma.inboxMessage.update({
    where: { id },
    data: {
      status: message.status === "PROCESSED" ? message.status : "ANALYZED",
      aiJson: JSON.stringify(extract),
      body,
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
  const message = await prisma.inboxMessage.findUnique({
    where: { id: opts.id },
    include: { forwardedBy: { select: { name: true, phone: true, email: true } } },
  });
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
  const sourcePack = buildInboxSourcePack(message);
  const description = withSourcePack(extract.description || text, sourcePack);
  const taskInstructions = withSourcePack(extract.recommendation || extract.description || text, sourcePack);

  const evidence = await prisma.evidence.create({
    data: {
      type: "CHAT",
      title: extract.title || message.subject || "收件信息",
      chatText: sourcePack || text,
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
      description,
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
  const savedFiles: Array<{ name: string; filePath: string; mime: string; size: number; image: boolean }> = [];
  for (const file of files) {
    try {
      const buf = Buffer.from(file.base64, "base64");
      const ext = path.extname(file.name) || "";
      const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext || ""}`;
      const saved = await saveBuffer(buf, filename, "evidence", file.mime);
      savedFiles.push({
        name: file.name,
        filePath: saved.filePath,
        mime: file.mime,
        size: buf.length,
        image: isImageFile(file),
      });
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
    const firstImage = savedFiles.find((f) => f.image);
    task = await prisma.task.create({
      data: {
        title: `跟進：${created.title}`,
        instructions: taskInstructions,
        caseId: created.id,
        assigneeId:
          (await resolveActorId(opts.assigneeId || opts.userId)) || undefined,
        dueAt,
        attachments: savedFiles.length
          ? {
              create: savedFiles.map((f) => ({
                name: f.name,
                filePath: f.filePath,
                mime: f.mime,
                size: f.size,
                isCover: Boolean(firstImage && f.filePath === firstImage.filePath),
              })),
            }
          : undefined,
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
