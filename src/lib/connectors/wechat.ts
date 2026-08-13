import type { InboxConnector, NormalizedInboxMessage } from "./types";

/**
 * WeChat connector (企业微信 / 公众号)
 * INSERT: WeChat Work callback or Official Account message API
 *   Webhook: POST /api/connectors/wechat/webhook
 *   Env: WECHAT_APP_ID, WECHAT_APP_SECRET, WECHAT_TOKEN
 */
export const wechatConnector: InboxConnector = {
  channel: "WECHAT",

  async importFromPaste(input: unknown): Promise<NormalizedInboxMessage[]> {
    const raw = typeof input === "string" ? input : String((input as { text?: string })?.text || "");
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (!lines.length) return [];

    // Common paste: "张工：B区围栏未装"
    return lines.map((line) => {
      const m = line.match(/^([^:：]+)[:：]\s*(.+)$/);
      return {
        channel: "WECHAT" as const,
        sender: m ? m[1].trim() : "微信用戶",
        body: m ? m[2].trim() : line,
        receivedAt: new Date(),
        rawPayload: { line },
      };
    });
  },

  async syncFromProvider(): Promise<NormalizedInboxMessage[]> {
    // INSERT: WeChat message sync / decrypt callback XML
    if (!process.env.WECHAT_APP_ID) return [];
    return [];
  },
};
