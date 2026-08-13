import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { persistNormalizedMessages } from "@/lib/inbox";
import type { NormalizedInboxMessage } from "@/lib/connectors";

/**
 * WhatsApp Business Cloud API webhook
 * INSERT: verify token + decrypt/parse WhatsApp payload
 *
 * Meta setup:
 *   Callback URL: https://your-host/api/connectors/whatsapp/webhook
 *   Verify token: WHATSAPP_VERIFY_TOKEN
 *   Env: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge || "", { status: 200 });
  }
  return NextResponse.json({ ok: true, connector: "whatsapp", mode: "stub" });
}

export async function POST(req: Request) {
  const project = await prisma.project.findFirst();
  if (!project) return NextResponse.json({ error: "No project" }, { status: 400 });

  const payload = await req.json().catch(() => ({}));

  // INSERT: map WhatsApp webhook entry[].changes[].value.messages[] → NormalizedInboxMessage
  const messages: NormalizedInboxMessage[] = [];

  try {
    const entries = payload?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        for (const msg of change.value?.messages || []) {
          messages.push({
            channel: "WHATSAPP",
            externalId: msg.id,
            sender: msg.from || change.value?.contacts?.[0]?.profile?.name || "WhatsApp",
            body: msg.text?.body || msg.caption || "[媒体消息]",
            receivedAt: msg.timestamp
              ? new Date(Number(msg.timestamp) * 1000)
              : new Date(),
            rawPayload: msg,
          });
        }
      }
    }
  } catch {
    // fall through
  }

  // Demo fallback: allow { text, sender } for manual webhook tests
  if (!messages.length && (payload.text || payload.body)) {
    messages.push({
      channel: "WHATSAPP",
      sender: payload.sender || "WhatsApp",
      body: payload.text || payload.body,
      receivedAt: new Date(),
      rawPayload: payload,
    });
  }

  if (!messages.length) {
    return NextResponse.json({
      ok: true,
      ingested: 0,
      hint: "INSERT real WhatsApp parser; or POST { text, sender } for demo",
    });
  }

  const created = await persistNormalizedMessages(project.id, messages);
  return NextResponse.json({ ok: true, ingested: created.length, ids: created.map((c) => c.id) });
}
