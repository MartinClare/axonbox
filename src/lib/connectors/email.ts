import type { InboxConnector, NormalizedInboxMessage } from "./types";

/**
 * Email connector
 * INSERT: Gmail API or Microsoft Graph
 *   Gmail: users.messages.list + users.messages.get
 *   Graph: /me/mailFolders/inbox/messages
 *   Webhook: POST /api/connectors/email/webhook
 */
export const emailConnector: InboxConnector = {
  channel: "EMAIL",

  async importFromPaste(input: unknown): Promise<NormalizedInboxMessage[]> {
    const data = (typeof input === "string"
      ? { body: input }
      : (input as {
          from?: string;
          subject?: string;
          body?: string;
          attachments?: string[];
        })) || {};

    const body = data.body || "";
    if (!body.trim() && !data.subject) return [];

    return [
      {
        channel: "EMAIL",
        sender: data.from || "site@example.com",
        subject: data.subject || "（无主题）",
        body,
        attachments: data.attachments || [],
        receivedAt: new Date(),
        rawPayload: data,
      },
    ];
  },

  async syncFromProvider(): Promise<NormalizedInboxMessage[]> {
    // INSERT: Gmail / Graph pull using GMAIL_REFRESH_TOKEN or MS_GRAPH_TOKEN
    if (!process.env.GMAIL_REFRESH_TOKEN && !process.env.MS_GRAPH_TOKEN) return [];
    return [];
  },
};

/** @deprecated use emailConnector.importFromPaste */
export async function importEmailMessages(input: {
  from?: string;
  subject?: string;
  body: string;
  attachments?: string[];
}) {
  const rows = await emailConnector.importFromPaste(input);
  return rows.map((r) => ({
    from: r.sender,
    subject: r.subject || "",
    body: r.body,
    attachments: r.attachments || [],
  }));
}
