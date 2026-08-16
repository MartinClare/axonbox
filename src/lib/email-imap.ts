import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import {
  inboundImapConfigured,
  inboundToNormalized,
  unwrapForwarded,
  htmlToText,
  type InboundAttachment,
  type InboundEmail,
} from "@/lib/email-inbound";
import type { NormalizedInboxMessage } from "@/lib/connectors";

const MAX_FILE_BYTES = 8_000_000;
const MAX_MESSAGES = 20;

export async function fetchUnseenInboundEmails(): Promise<NormalizedInboxMessage[]> {
  if (!inboundImapConfigured()) return [];

  const client = new ImapFlow({
    host: process.env.IMAP_HOST!,
    port: Number(process.env.IMAP_PORT || 993),
    secure: process.env.IMAP_SECURE !== "false",
    auth: {
      user: process.env.IMAP_USER!,
      pass: process.env.IMAP_PASSWORD!,
    },
    logger: false,
  });

  const messages: NormalizedInboxMessage[] = [];
  await client.connect();
  const lock = await client.getMailboxLock(process.env.IMAP_MAILBOX || "INBOX");
  try {
    const uids: number[] = [];
    for await (const msg of client.fetch({ seen: false }, { uid: true, source: true })) {
      if (!msg.source) continue;
      uids.push(msg.uid);
      const parsed = await simpleParser(msg.source);
      const html = typeof parsed.html === "string" ? parsed.html : "";
      const rawText =
        (typeof parsed.text === "string" && parsed.text) ||
        (html ? htmlToText(html) : "");
      const forwarded = unwrapForwarded(rawText);
      const attachments: InboundAttachment[] = [];
      for (const att of parsed.attachments || []) {
        if (attachments.length >= 8) break;
        if (att.size && att.size > MAX_FILE_BYTES) continue;
        attachments.push({
          name: att.filename || "attachment",
          mime: att.contentType || "application/octet-stream",
          base64: att.content.toString("base64"),
        });
      }
      const email: InboundEmail = {
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
        attachments,
      };
      messages.push(inboundToNormalized(email));
      if (messages.length >= MAX_MESSAGES) break;
    }
    if (uids.length) {
      await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
    }
  } finally {
    lock.release();
    await client.logout().catch(() => undefined);
  }
  return messages;
}
