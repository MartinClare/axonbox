import { mailboxAlias } from "@/lib/email-inbound";
import { isAudioFile, isDocumentFile, isImageFile, resolveInboxFiles } from "@/lib/inbound-files";
import { SOURCE_PACK_MARK } from "@/lib/inbox-source-pack";

export { SOURCE_PACK_MARK, splitSourcePack, withSourcePack } from "@/lib/inbox-source-pack";

type InboxSourceInput = {
  channel: string;
  sender: string;
  subject?: string | null;
  body: string;
  rawPayload?: string | null;
  attachments?: string | null;
  receivedAt: Date;
  forwardedBy?: { name: string | null; phone?: string | null; email?: string | null } | null;
};

function parseRaw(rawPayload?: string | null): Record<string, unknown> {
  if (!rawPayload) return {};
  try {
    const v = JSON.parse(rawPayload);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function digits(raw: string) {
  return raw.replace(/\D/g, "");
}

export function formatPhoneDisplay(raw: string) {
  const d = digits(raw);
  if (d.length === 8) return `+852 ${d}`;
  if (d.startsWith("852") && d.length === 11) return `+852 ${d.slice(3)}`;
  if (d.length >= 10 && raw.trim().startsWith("+")) return `+${d}`;
  if (d.length >= 8) return `+${d}`;
  return raw.trim();
}

function unique(items: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

function phonesFromText(text: string) {
  const found: string[] = [];
  const matches = text.match(/\+?\d[\d\s-]{6,16}\d/g) || [];
  for (const p of matches) {
    const d = digits(p);
    if (d.length === 8 || (d.startsWith("852") && d.length === 11) || (p.includes("+") && d.length >= 10 && d.length <= 15)) {
      found.push(formatPhoneDisplay(p));
    }
  }
  return unique(found);
}

function emailsFromText(text: string) {
  return unique(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []);
}

function contactsFromRaw(raw: Record<string, unknown>) {
  const contacts = Array.isArray(raw.contacts) ? raw.contacts : [];
  const lines: string[] = [];
  for (const item of contacts) {
    if (!item || typeof item !== "object") continue;
    const c = item as {
      name?: { formatted_name?: string; first_name?: string };
      phones?: Array<{ phone?: string }>;
    };
    const name = c.name?.formatted_name || c.name?.first_name || "";
    const phones = (c.phones || [])
      .map((p) => (p.phone ? formatPhoneDisplay(p.phone) : ""))
      .filter(Boolean);
    if (name && phones.length) lines.push(`${name} ${phones.join("、")}`);
    else if (name) lines.push(name);
    else if (phones.length) lines.push(phones.join("、"));
  }
  return lines;
}

function fileLabel(file: { name: string; mime?: string }) {
  if (isImageFile(file)) return `${file.name}（圖片）`;
  if (isAudioFile(file)) return `${file.name}（語音）`;
  if (isDocumentFile(file)) return `${file.name}（文件）`;
  return file.name;
}

function channelLabel(channel: string) {
  if (channel === "WHATSAPP") return "WhatsApp";
  if (channel === "EMAIL") return "電郵";
  if (channel === "WECHAT") return "WeChat";
  return channel;
}

export function buildInboxSourcePack(message: InboxSourceInput) {
  const raw = parseRaw(message.rawPayload);
  const files = resolveInboxFiles(message.attachments, message.rawPayload);
  const body = (message.body || "").trim();
  const blob = `${message.sender}\n${message.subject || ""}\n${body}\n${JSON.stringify(raw)}`;

  const senderPhone =
    formatPhoneDisplay(String(raw.phone || "")) ||
    (digits(String(raw.from || "")).length >= 8 ? formatPhoneDisplay(String(raw.from)) : "");
  const fromEmail =
    String(raw.from || "").includes("@")
      ? String(raw.from)
      : emailsFromText(String(raw.from || ""))[0] || "";
  const mailbox = String(raw.mailbox || mailboxAlias(String(raw.to || raw.receivedFor || "")) || "");
  const phones = unique(
    [senderPhone, message.forwardedBy?.phone ? formatPhoneDisplay(message.forwardedBy.phone) : "", ...phonesFromText(blob)].filter(
      Boolean,
    ) as string[],
  );
  const emails = unique(
    [fromEmail, message.forwardedBy?.email || "", ...emailsFromText(blob)].filter(Boolean),
  );
  const contacts = contactsFromRaw(raw);
  const received = message.receivedAt.toLocaleString("zh-HK", { hour12: true });

  const lines: string[] = [];
  lines.push(`渠道：${channelLabel(message.channel)}`);
  lines.push(`發送人：${message.sender}`);
  if (message.forwardedBy?.name) lines.push(`轉發人：${message.forwardedBy.name}`);
  if (mailbox) lines.push(`收件信箱：${mailbox}`);
  if (phones.length) lines.push(`電話：${phones.join("、")}`);
  if (emails.length) lines.push(`電郵：${emails.join("、")}`);
  if (contacts.length) {
    lines.push("聯絡人：");
    for (const c of contacts) lines.push(`- ${c}`);
  }
  lines.push(`收件時間：${received}`);
  if (message.subject) lines.push(`主旨：${message.subject}`);
  lines.push("");
  lines.push("原文：");
  lines.push(body || "（無文字）");
  lines.push("");
  if (files.length) {
    lines.push("附件：");
    for (const f of files) lines.push(`- ${fileLabel(f)}`);
  } else {
    lines.push("附件：無");
  }

  return lines.join("\n").trim();
}
