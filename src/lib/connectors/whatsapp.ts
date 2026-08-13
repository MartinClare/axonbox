import type { InboxConnector, NormalizedInboxMessage } from "./types";

/**
 * WhatsApp connector
 * INSERT: WhatsApp Business Cloud API
 *   GET https://graph.facebook.com/v19.0/{PHONE_NUMBER_ID}/messages
 *   Webhook: POST /api/connectors/whatsapp/webhook
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
    // INSERT: WhatsApp Cloud API sync using WHATSAPP_ACCESS_TOKEN
    if (!process.env.WHATSAPP_ACCESS_TOKEN) return [];
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
