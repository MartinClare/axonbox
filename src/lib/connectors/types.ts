/**
 * Unified inbox connector adapters.
 *
 * INSERT REAL APIs HERE:
 * - WhatsApp Business Cloud API
 * - Gmail / Microsoft Graph (email)
 * - WeChat Work / Official Account callbacks
 *
 * Demo mode uses paste / stub parsers so the full
 * 收件 → 分析 → 事件 → 任務 pipeline works without keys.
 */

export type InboxChannel = "WHATSAPP" | "EMAIL" | "WECHAT" | "MANUAL";

export type InboxAttachment =
  | string
  | {
      name?: string;
      mime?: string;
      base64?: string;
      filePath?: string;
      ycloudId?: string;
      ycloudLink?: string;
    };

export type NormalizedInboxMessage = {
  channel: InboxChannel;
  externalId?: string;
  sender: string;
  subject?: string;
  body: string;
  attachments?: InboxAttachment[];
  receivedAt?: Date;
  rawPayload?: unknown;
};

export interface InboxConnector {
  channel: InboxChannel;
  /** Parse pasted text / form input for demos */
  importFromPaste(input: unknown): Promise<NormalizedInboxMessage[]>;
  /**
   * INSERT POINT: pull from live provider (OAuth / webhook backlog).
   * Return [] until credentials are configured.
   */
  syncFromProvider?(projectId: string): Promise<NormalizedInboxMessage[]>;
}

export function connectorConfigured(channel: InboxChannel): boolean {
  switch (channel) {
    case "WHATSAPP":
      return Boolean(process.env.YCLOUD_API_KEY?.trim());
    case "EMAIL":
      return Boolean(
        process.env.INBOUND_EMAIL_ADDRESS ||
          process.env.INBOUND_WEBHOOK_SECRET ||
          process.env.IMAP_HOST ||
          process.env.GMAIL_REFRESH_TOKEN ||
          process.env.MS_GRAPH_TOKEN,
      );
    case "WECHAT":
      return Boolean(process.env.WECHAT_APP_ID && process.env.WECHAT_APP_SECRET);
    default:
      return false;
  }
}
