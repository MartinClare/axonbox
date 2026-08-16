import {
  extractEmailAddress,
  htmlToText,
  unwrapForwarded,
  type InboundAttachment,
  type InboundEmail,
} from "@/lib/email-inbound";

type ResendReceived = {
  id?: string;
  from?: string;
  to?: string[] | string;
  received_for?: string[] | string;
  subject?: string;
  text?: string | null;
  html?: string | null;
  message_id?: string;
  attachments?: Array<{
    id?: string;
    filename?: string;
    content_type?: string;
    download_url?: string;
  }>;
};

function firstAddress(value?: string[] | string) {
  if (Array.isArray(value)) return value.find((item) => item?.trim())?.trim() || "";
  return value?.trim() || "";
}

function isResendReceivedEvent(payload: Record<string, unknown>) {
  if (payload.type !== "email.received") return false;
  const data = payload.data;
  return Boolean(data && typeof data === "object" && (data as { email_id?: string }).email_id);
}

async function fetchAttachmentBase64(
  apiKey: string,
  emailId: string,
  attachmentId: string,
) {
  const res = await fetch(
    `https://api.resend.com/emails/receiving/${emailId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) return null;
  const json = (await res.json()) as {
    download_url?: string;
    data?: { download_url?: string };
  };
  const url = json.download_url || json.data?.download_url;
  if (!url) return null;
  const file = await fetch(url);
  if (!file.ok) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  return buf.toString("base64");
}

async function receivedToInbound(
  apiKey: string,
  email: ResendReceived,
  fallbackId?: string,
): Promise<InboundEmail> {
  const html = email.html || "";
  const rawText = email.text || (html ? htmlToText(html) : "");
  const forwarded = unwrapForwarded(rawText);
  const attachments: InboundAttachment[] = [];
  const emailId = email.id || fallbackId;
  for (const att of email.attachments || []) {
    if (attachments.length >= 8) break;
    if (!att.id || !emailId) continue;
    const base64 = await fetchAttachmentBase64(apiKey, emailId, att.id);
    if (!base64) continue;
    if (Math.ceil((base64.length * 3) / 4) > 8_000_000) continue;
    attachments.push({
      name: att.filename || "attachment",
      mime: att.content_type || "application/octet-stream",
      base64,
    });
  }

  return {
    from:
      forwarded.from ||
      (email.from ? extractEmailAddress(email.from) : "") ||
      "mail@unknown",
    to: firstAddress(email.received_for) || firstAddress(email.to),
    subject: forwarded.subject || email.subject || "（無主題）",
    text: forwarded.text || rawText,
    html: html || undefined,
    messageId: email.message_id || email.id || fallbackId,
    attachments,
    raw: { provider: "resend", email_id: emailId },
  };
}

export async function hydrateResendInbound(
  payload: Record<string, unknown>,
): Promise<InboundEmail | null> {
  if (!isResendReceivedEvent(payload)) return null;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const data = payload.data as {
    email_id?: string;
    message_id?: string;
    to?: string[] | string;
    received_for?: string[] | string;
  };
  if (!apiKey || !data.email_id) return null;

  const res = await fetch(
    `https://api.resend.com/emails/receiving/${data.email_id}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) {
    console.error("[resend.inbound] fetch email failed", res.status);
    return null;
  }
  const email = (await res.json()) as ResendReceived;
  email.received_for = email.received_for || data.received_for;
  email.to = email.to || data.to;
  return receivedToInbound(apiKey, email, data.email_id);
}

export async function fetchResendReceivedEmails(): Promise<InboundEmail[]> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return [];

  const listRes = await fetch("https://api.resend.com/emails/receiving?limit=20", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!listRes.ok) {
    throw new Error(`Resend receiving list failed (${listRes.status})`);
  }
  const list = (await listRes.json()) as { data?: Array<{ id?: string }> };
  const emails: InboundEmail[] = [];
  for (const row of list.data || []) {
    if (!row.id) continue;
    const res = await fetch(`https://api.resend.com/emails/receiving/${row.id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) continue;
    const email = (await res.json()) as ResendReceived;
    emails.push(await receivedToInbound(apiKey, email, row.id));
  }
  return emails;
}
