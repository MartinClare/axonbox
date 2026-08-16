import { createHmac, timingSafeEqual } from "crypto";
import { MAX_FILE_BYTES, MAX_FILES } from "@/lib/inbound-files";
import type { InboxAttachment, InboxConnector, NormalizedInboxMessage } from "./types";

const BUNDLE_WINDOW_MS = 3 * 60 * 1000;

type YCloudMedia = {
  id?: string;
  link?: string;
  caption?: string;
  filename?: string;
  mime_type?: string;
  mimeType?: string;
  sha256?: string;
};

type YCloudInbound = {
  id?: string;
  wamid?: string;
  from?: string;
  to?: string;
  sendTime?: string;
  type?: string;
  customerProfile?: { name?: string; username?: string };
  text?: { body?: string };
  image?: YCloudMedia;
  audio?: YCloudMedia;
  document?: YCloudMedia;
  video?: YCloudMedia;
  location?: {
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
  };
  context?: { forwarded?: boolean; id?: string };
};

export function isWhatsAppCaseSeparator(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const firstLine = t.split(/\r?\n/)[0]?.trim() || t;
  if (/^[-–—=]{3,}$/.test(firstLine)) return true;
  return /^(?:以下是另一個(?:案)?|以下係另一(?:個案)?|另一個案|另一宗|下一宗|下一個事件|another\s*case|new\s*case)\b/i.test(
    firstLine,
  );
}

/** Strip separator phrase; remainder becomes the new case body. */
export function stripWhatsAppCaseSeparator(text: string): string {
  const t = text.trim();
  if (/^[-–—=]{3,}$/.test(t)) return "";
  return t
    .replace(
      /^(?:以下是另一個(?:案)?|以下係另一(?:個案)?|另一個案|另一宗|下一宗|下一個事件|another\s*case|new\s*case)[:：\s]*/i,
      "",
    )
    .trim();
}

export function normalizePhone(raw?: string | null): string {
  if (!raw) return "";
  return String(raw).replace(/\D/g, "");
}

export function whatsappBundleWindowMs() {
  return BUNDLE_WINDOW_MS;
}

export function verifyYCloudSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.YCLOUD_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    }),
  );
  const timestamp = parts.t;
  const sig = parts.s;
  if (!timestamp || !sig) return false;

  const ageMs = Math.abs(Date.now() - Number(timestamp) * 1000);
  if (!Number.isFinite(ageMs) || ageMs > 10 * 60 * 1000) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(sig, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function downloadYCloudMedia(
  media: YCloudMedia | undefined,
  fallbackName: string,
): Promise<InboxAttachment | null> {
  if (!media?.link) return null;
  const apiKey = process.env.YCLOUD_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[whatsapp] YCLOUD_API_KEY missing; skip media download");
    return null;
  }

  try {
    const res = await fetch(media.link, {
      headers: { "X-API-Key": apiKey },
    });
    if (!res.ok) {
      console.error("[whatsapp] media download failed", res.status, media.link);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_FILE_BYTES) {
      console.warn("[whatsapp] media too large", buf.length);
      return null;
    }
    const mime =
      media.mime_type ||
      media.mimeType ||
      res.headers.get("content-type") ||
      "application/octet-stream";
    const name = media.filename || fallbackName;
    return { name, mime, base64: buf.toString("base64") };
  } catch (err) {
    console.error("[whatsapp] media download error", err);
    return null;
  }
}

export async function parseYCloudInboundEvent(
  payload: unknown,
): Promise<{ ackOnly: boolean; message: NormalizedInboxMessage | null }> {
  const event = (payload || {}) as {
    type?: string;
    whatsappInboundMessage?: YCloudInbound;
    text?: string;
    body?: string;
    sender?: string;
  };

  const type = String(event.type || "");

  // Coexist echoes / history / contact sync — ACK only, never create cases
  if (
    type === "whatsapp.smb.message.echoes" ||
    type === "whatsapp.smb.history" ||
    type === "whatsapp.smb.app.state.sync" ||
    type === "whatsapp.message.updated"
  ) {
    return { ackOnly: true, message: null };
  }

  if (type && type !== "whatsapp.inbound_message.received") {
    return { ackOnly: true, message: null };
  }

  const inbound = event.whatsappInboundMessage;
  if (!inbound && (event.text || event.body)) {
    // Demo / manual test payload
    return {
      ackOnly: false,
      message: {
        channel: "WHATSAPP",
        sender: event.sender || "WhatsApp",
        body: String(event.text || event.body || ""),
        receivedAt: new Date(),
        rawPayload: payload,
      },
    };
  }

  if (!inbound) return { ackOnly: true, message: null };

  const msgType = String(inbound.type || "text");
  if (["video", "sticker", "reaction", "button", "interactive", "unsupported"].includes(msgType)) {
    return { ackOnly: true, message: null };
  }

  const profileName = inbound.customerProfile?.name?.trim();
  const from = inbound.from || "";
  const sender = profileName || from || "WhatsApp";
  const externalId = inbound.wamid || inbound.id;
  const forwarded = Boolean(inbound.context?.forwarded);
  const attachments: InboxAttachment[] = [];
  const bodyParts: string[] = [];

  if (forwarded) bodyParts.push("[轉發]");

  if (msgType === "text" && inbound.text?.body) {
    bodyParts.push(inbound.text.body);
  } else if (msgType === "image" && inbound.image) {
    if (inbound.image.caption) bodyParts.push(inbound.image.caption);
    const file = await downloadYCloudMedia(inbound.image, `image-${inbound.image.id || "wa"}.jpg`);
    if (file) attachments.push(file);
    if (!inbound.image.caption && !file) bodyParts.push("[圖片]");
  } else if (msgType === "audio" && inbound.audio) {
    const file = await downloadYCloudMedia(inbound.audio, `voice-${inbound.audio.id || "wa"}.ogg`);
    if (file) attachments.push(file);
    else bodyParts.push("[語音]");
  } else if (msgType === "document" && inbound.document) {
    if (inbound.document.caption) bodyParts.push(inbound.document.caption);
    const file = await downloadYCloudMedia(
      inbound.document,
      inbound.document.filename || `doc-${inbound.document.id || "wa"}.pdf`,
    );
    if (file) attachments.push(file);
    if (!inbound.document.caption && !file) bodyParts.push("[文件]");
  } else if (msgType === "location" && inbound.location) {
    const loc = inbound.location;
    bodyParts.push(
      [
        loc.name,
        loc.address,
        loc.latitude != null && loc.longitude != null
          ? `座標 ${loc.latitude}, ${loc.longitude}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ") || "[位置]",
    );
  } else if (inbound.text?.body) {
    bodyParts.push(inbound.text.body);
  }

  const body = bodyParts.filter(Boolean).join("\n").trim();
  if (!body && !attachments.length) {
    return { ackOnly: true, message: null };
  }

  return {
    ackOnly: false,
    message: {
      channel: "WHATSAPP",
      externalId,
      sender,
      body,
      attachments: attachments.slice(0, MAX_FILES),
      receivedAt: inbound.sendTime ? new Date(inbound.sendTime) : new Date(),
      rawPayload: {
        ...inbound,
        from,
        to: inbound.to,
        phone: normalizePhone(from),
        profileName,
        forwarded,
      },
    },
  };
}

/**
 * WhatsApp connector via YCloud (coexist / Cloud API).
 * Webhook: POST /api/connectors/whatsapp/webhook
 */
export const whatsappConnector: InboxConnector = {
  channel: "WHATSAPP",

  async importFromPaste(input: unknown): Promise<NormalizedInboxMessage[]> {
    const raw = typeof input === "string" ? input : String((input as { text?: string })?.text || "");
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const messages: NormalizedInboxMessage[] = [];
    for (const line of lines) {
      const m = line.match(/^\[?(.*?)\]?\s*([^:：]+)[:：]\s*(.+)$/);
      if (m) {
        messages.push({
          channel: "WHATSAPP",
          sender: m[2].trim(),
          body: m[3].trim(),
          receivedAt: m[1] ? new Date(m[1]) : new Date(),
          rawPayload: { line },
        });
      } else {
        messages.push({
          channel: "WHATSAPP",
          sender: "未知",
          body: line,
          receivedAt: new Date(),
        });
      }
    }
    return messages.length ? messages : [{ channel: "WHATSAPP", sender: "未知", body: raw }];
  },

  async syncFromProvider(): Promise<NormalizedInboxMessage[]> {
    if (!process.env.YCLOUD_API_KEY) return [];
    return [];
  },
};

/** @deprecated use whatsappConnector.importFromPaste */
export async function importWhatsAppMessages(raw: string) {
  const rows = await whatsappConnector.importFromPaste(raw);
  return rows.map((r) => ({
    sender: r.sender,
    text: r.body,
    timestamp: r.receivedAt?.toISOString(),
  }));
}
