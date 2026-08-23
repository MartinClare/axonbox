import type { NormalizedInboxMessage } from "@/lib/connectors";
import {
  MAX_DOWNLOAD_BYTES,
  isInlineOrSignatureImage,
  selectInboundAttachments,
} from "@/lib/inbound-files";

export type InboundAttachment = {
  name?: string;
  mime?: string;
  base64?: string;
  filePath?: string;
  contentDisposition?: string;
  cid?: string;
  related?: boolean;
  bytes?: number;
};

export type InboundEmail = {
  from: string;
  to?: string;
  subject: string;
  text: string;
  html?: string;
  messageId?: string;
  attachments: InboundAttachment[];
  raw?: unknown;
};

export function getInboundAddress(orgAddress?: string | null) {
  return (
    process.env.INBOUND_EMAIL_ADDRESS?.trim() ||
    orgAddress?.trim() ||
    ""
  );
}

export function getInboundWebhookUrl() {
  const base = (
    process.env.NEXTAUTH_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : "http://localhost:3000")
  ).replace(/\/$/, "");
  const token = process.env.INBOUND_WEBHOOK_SECRET?.trim();
  const url = `${base}/api/connectors/email/webhook`;
  return token ? `${url}?token=${encodeURIComponent(token)}` : url;
}

export function inboundImapConfigured() {
  return Boolean(
    process.env.IMAP_HOST?.trim() &&
      process.env.IMAP_USER?.trim() &&
      process.env.IMAP_PASSWORD?.trim(),
  );
}

export function inboundWebhookConfigured() {
  return Boolean(process.env.INBOUND_WEBHOOK_SECRET?.trim());
}

export function inboundResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function verifyInboundSecret(req: Request) {
  const expected = process.env.INBOUND_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  const url = new URL(req.url);
  const token =
    url.searchParams.get("token") ||
    req.headers.get("x-inbound-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  return token === expected;
}

export function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
      return value[0].trim();
    }
  }
  return "";
}

export function extractEmailAddress(raw: string) {
  const match = raw.match(/<([^>]+@[^>]+)>/);
  return (match?.[1] || raw).trim();
}

export function mailboxAlias(address?: string | null) {
  if (!address) return "";
  const email = extractEmailAddress(address);
  const at = email.lastIndexOf("@");
  return at > 0 ? email.slice(0, at).trim() : "";
}

export function inboundDomain(address?: string | null) {
  if (!address) return "";
  const email = extractEmailAddress(address);
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).trim() : "";
}

export function unwrapForwarded(text: string) {
  const markers = [
    /^-{2,}\s*Forwarded message\s*-{2,}/im,
    /^-{2,}\s*轉寄的郵件\s*-{2,}/im,
    /^-{2,}\s*转发的邮件\s*-{2,}/im,
    /^Begin forwarded message:/im,
  ];
  let splitAt = -1;
  for (const marker of markers) {
    const match = marker.exec(text);
    if (match && match.index >= 0) {
      splitAt = match.index + match[0].length;
      break;
    }
  }
  if (splitAt < 0) {
    return { text: text.trim(), from: "", subject: "" };
  }
  const rest = text.slice(splitAt).trim();
  const from = rest.match(/^From:\s*(.+)$/im)?.[1]?.trim() || "";
  const subject = rest.match(/^Subject:\s*(.+)$/im)?.[1]?.trim() || "";
  const bodyStart = rest.search(/\n\s*\n/);
  const body = bodyStart >= 0 ? rest.slice(bodyStart).trim() : rest;
  return {
    text: body || rest,
    from: from ? extractEmailAddress(from) : "",
    subject,
  };
}

function pushFile(
  attachments: InboundAttachment[],
  file: {
    name?: string;
    mime?: string;
    base64?: string;
    bytes?: number;
    contentDisposition?: string;
    cid?: string;
    related?: boolean;
  },
) {
  if (!file.base64 && !file.bytes) return;
  const bytes = file.bytes ?? Math.ceil(((file.base64 || "").length * 3) / 4);
  if (bytes > MAX_DOWNLOAD_BYTES) return;
  if (
    isInlineOrSignatureImage({
      name: file.name,
      mime: file.mime,
      bytes,
      contentDisposition: file.contentDisposition,
      cid: file.cid,
      related: file.related,
    })
  ) {
    return;
  }
  attachments.push({
    name: file.name || "attachment",
    mime: file.mime || "application/octet-stream",
    base64: file.base64 ? file.base64.replace(/^data:[^;]+;base64,/, "") : undefined,
    contentDisposition: file.contentDisposition,
    cid: file.cid,
    related: file.related,
    bytes,
  });
}

async function fileToAttachment(file: File): Promise<InboundAttachment | null> {
  if (file.size > MAX_DOWNLOAD_BYTES) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  return {
    name: file.name || "attachment",
    mime: file.type || "application/octet-stream",
    base64: buf.toString("base64"),
  };
}

function parseMessageIdFromHeaders(headers: string) {
  return headers.match(/Message-ID:\s*(<[^>]+>|[^\s]+)/i)?.[1]?.trim() || "";
}

function parseSendGridEnvelope(raw?: string) {
  if (!raw) return { from: "", to: "" };
  try {
    const envelope = JSON.parse(raw) as { from?: string; to?: string[] | string };
    const to = Array.isArray(envelope.to) ? envelope.to[0] : envelope.to;
    return {
      from: envelope.from ? extractEmailAddress(envelope.from) : "",
      to: to ? extractEmailAddress(String(to)) : "",
    };
  } catch {
    return { from: "", to: "" };
  }
}

function applyAttachmentInfo(
  fields: Record<string, string>,
  attachments: InboundAttachment[],
) {
  const infoRaw = fields["attachment-info"];
  if (!infoRaw) return attachments;
  try {
    const info = JSON.parse(infoRaw) as Record<
      string,
      { filename?: string; type?: string; name?: string }
    >;
    // SendGrid names files attachment1…; we already stored them in order.
    const meta = Object.values(info);
    return attachments.map((att, i) => ({
      name: att.name || meta[i]?.filename || meta[i]?.name || att.name,
      mime: att.mime || meta[i]?.type || att.mime,
      base64: att.base64,
    }));
  } catch {
    return attachments;
  }
}

async function fromRawMime(raw: string): Promise<InboundEmail | null> {
  if (!raw.includes("From:") && !raw.includes("Subject:")) return null;
  const { simpleParser } = await import("mailparser");
  const parsed = await simpleParser(raw);
  const html = typeof parsed.html === "string" ? parsed.html : "";
  const rawText =
    (typeof parsed.text === "string" && parsed.text) ||
    (html ? htmlToText(html) : "");
  const forwarded = unwrapForwarded(rawText);
  const attachments: InboundAttachment[] = [];
  for (const att of parsed.attachments || []) {
    const mime = att.contentType || "";
    pushFile(attachments, {
      name: att.filename || "attachment",
      mime,
      base64: att.content.toString("base64"),
      bytes: att.size,
      contentDisposition: att.contentDisposition,
      cid: att.cid,
      related: att.related,
    });
  }
  return {
    from:
      forwarded.from ||
      parsed.from?.value?.[0]?.address ||
      parsed.from?.text ||
      "mail@unknown",
    to: Array.isArray(parsed.to) ? parsed.to[0]?.text : parsed.to?.text,
    subject: forwarded.subject || parsed.subject || "（無主題）",
    text: forwarded.text || rawText,
    html: html || undefined,
    messageId: parsed.messageId,
    attachments: selectInboundAttachments(attachments),
    raw: { mime: true },
  };
}

function fromFormRecord(fields: Record<string, string>, attachments: InboundAttachment[]): InboundEmail {
  const envelope = parseSendGridEnvelope(fields.envelope);
  const html = firstString(fields.html, fields["body-html"], fields["stripped-html"]);
  const rawText = firstString(
    fields.text,
    fields.body,
    fields["body-plain"],
    fields["stripped-text"],
    fields["text-plain"],
  );
  const text = rawText || (html ? htmlToText(html) : "");
  const forwarded = unwrapForwarded(text);
  const from = extractEmailAddress(
    forwarded.from ||
      firstString(fields.from, fields.sender, fields.From, fields["from_email"]) ||
      envelope.from,
  );
  const subject =
    forwarded.subject || firstString(fields.subject, fields.Subject) || "（無主題）";
  const messageId = firstString(
    fields.messageId,
    fields["message-id"],
    fields.MessageID,
    fields["Message-Id"],
    fields.headers ? parseMessageIdFromHeaders(fields.headers) : "",
  );

  return {
    from: from || "mail@unknown",
    to: firstString(fields.to, fields.recipient, fields.To) || envelope.to,
    subject,
    text: forwarded.text || text,
    html: html || undefined,
    messageId: messageId || undefined,
    attachments: selectInboundAttachments(applyAttachmentInfo(fields, attachments)),
    raw: { from, to: envelope.to, subject, messageId },
  };
}

function fromJsonPayload(payload: Record<string, unknown>): InboundEmail | null {
  const data =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : payload;
  const email =
    data.email && typeof data.email === "object"
      ? (data.email as Record<string, unknown>)
      : data;

  const html = firstString(email.html, email.bodyHtml, data.html);
  const rawText = firstString(
    email.text,
    email.body,
    email.bodyPlain,
    data.text,
    data.body,
    payload.text,
    payload.body,
  );
  const text = rawText || (html ? htmlToText(html) : "");
  const forwarded = unwrapForwarded(text);
  const from = extractEmailAddress(
    forwarded.from ||
      firstString(email.from, data.from, payload.from, email.sender, data.sender),
  );
  const subject =
    forwarded.subject ||
    firstString(email.subject, data.subject, payload.subject) ||
    "（無主題）";
  const messageId = firstString(
    email.messageId,
    email.message_id,
    data.messageId,
    data.message_id,
    payload.messageId,
    payload.id,
  );

  const attachments: InboundAttachment[] = [];
  const rawAtts = email.attachments || data.attachments || payload.attachments;
  if (Array.isArray(rawAtts)) {
    for (const item of rawAtts) {
      if (!item || typeof item !== "object") continue;
      const att = item as Record<string, unknown>;
      const content = firstString(att.base64, att.content, att.data);
      pushFile(attachments, {
        name: firstString(att.name, att.filename),
        mime: firstString(att.mime, att.contentType, att.type) || "application/octet-stream",
        base64: content,
      });
    }
  }

  if (!from && !subject && !text && !attachments.length) return null;

  return {
    from: from || "mail@unknown",
    to: firstString(email.to, data.to, payload.to),
    subject,
    text: forwarded.text || text,
    html: html || undefined,
    messageId: messageId || undefined,
    attachments: selectInboundAttachments(attachments),
    raw: payload,
  };
}

export async function parseInboundRequest(req: Request): Promise<InboundEmail | null> {
  const contentType = req.headers.get("content-type") || "";

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const form = await req.formData();
    const fields: Record<string, string> = {};
    const attachments: InboundAttachment[] = [];
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") {
        fields[key] = value;
        continue;
      }
      if (value instanceof File && value.size > 0) {
        const att = await fileToAttachment(value);
        if (att) attachments.push(att);
      }
    }
    // SendGrid "Post the raw, full MIME message" puts RFC822 in `email`
    if (fields.email && !fields.text && !fields.html) {
      const mimeParsed = await fromRawMime(fields.email);
      if (mimeParsed) return mimeParsed;
    }
    const parsed = fromFormRecord(fields, attachments);
    if (!parsed.text && !parsed.subject && !parsed.attachments.length) return null;
    return parsed;
  }

  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") return null;
  if (payload.type === "email.received") {
    const { hydrateResendInbound } = await import("@/lib/resend-inbound");
    const resend = await hydrateResendInbound(payload);
    if (resend) return resend;
  }
  return fromJsonPayload(payload);
}

export function inboundToNormalized(email: InboundEmail): NormalizedInboxMessage {
  return {
    channel: "EMAIL",
    externalId: email.messageId,
    sender: email.from,
    subject: email.subject,
    body: email.text,
    attachments: selectInboundAttachments(
      email.attachments.map((a) => ({
        name: a.name,
        mime: a.mime,
        base64: a.base64,
        filePath: a.filePath,
        contentDisposition: a.contentDisposition,
        cid: a.cid,
        related: a.related,
        bytes: a.bytes,
      })),
    ),
    receivedAt: new Date(),
    rawPayload: {
      ...(email.raw && typeof email.raw === "object" ? (email.raw as Record<string, unknown>) : {}),
      from: email.from,
      to: email.to,
      mailbox: mailboxAlias(email.to),
      subject: email.subject,
      messageId: email.messageId,
    },
  };
}
