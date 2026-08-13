import { emailConnector } from "./email";
import { whatsappConnector } from "./whatsapp";
import { wechatConnector } from "./wechat";
import {
  connectorConfigured,
  type InboxChannel,
  type InboxConnector,
  type NormalizedInboxMessage,
} from "./types";

export * from "./types";
export { emailConnector, whatsappConnector, wechatConnector };

const registry: Record<Exclude<InboxChannel, "MANUAL">, InboxConnector> = {
  WHATSAPP: whatsappConnector,
  EMAIL: emailConnector,
  WECHAT: wechatConnector,
};

export function getConnector(channel: InboxChannel): InboxConnector | null {
  if (channel === "MANUAL") return null;
  return registry[channel] || null;
}

export function listConnectorStatus() {
  return (Object.keys(registry) as Array<keyof typeof registry>).map((channel) => ({
    channel,
    configured: connectorConfigured(channel),
    // insertion hint for ops UI
    envHint:
      channel === "WHATSAPP"
        ? "WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID"
        : channel === "EMAIL"
          ? "GMAIL_REFRESH_TOKEN or MS_GRAPH_TOKEN"
          : "WECHAT_APP_ID + WECHAT_APP_SECRET",
  }));
}

export async function parseIntoInbox(
  channel: InboxChannel,
  input: unknown,
): Promise<NormalizedInboxMessage[]> {
  if (channel === "MANUAL") {
    const data = input as { sender?: string; subject?: string; body?: string };
    return [
      {
        channel: "MANUAL",
        sender: data.sender || "現場錄入",
        subject: data.subject,
        body: data.body || String(input),
        receivedAt: new Date(),
      },
    ];
  }
  const connector = getConnector(channel);
  if (!connector) return [];
  return connector.importFromPaste(input);
}
