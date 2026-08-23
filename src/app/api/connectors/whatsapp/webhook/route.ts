import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestAndPropose } from "@/lib/inbox";
import {
  parseYCloudInboundEvent,
  verifyYCloudSignature,
} from "@/lib/connectors/whatsapp";

export const maxDuration = 120;

/**
 * YCloud WhatsApp Cloud API webhook (dedicated intake number).
 *
 * YCloud Console → Developers → Webhooks:
 *   URL: https://your-host/api/connectors/whatsapp/webhook
 *   Events: whatsapp.inbound_message.received
 *   Env: YCLOUD_API_KEY, YCLOUD_WEBHOOK_SECRET
 *   Intake number (CS only, not shown in UI): WHATSAPP_DISPLAY_NUMBER=+85253688279
 *   Do not ingest Eesee (+85252907211) or StarChat (+85252951530) on the shared YCloud account.
 */
export async function GET() {
  return NextResponse.json({ ok: true, provider: "ycloud", connector: "whatsapp" });
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("YCloud-Signature") || req.headers.get("ycloud-signature");

  if (!verifyYCloudSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { ackOnly, message } = await parseYCloudInboundEvent(payload);
  if (ackOnly || !message) {
    return NextResponse.json({ ok: true, ingested: 0, ack: true });
  }

  const project = await prisma.project.findFirst();
  if (!project) return NextResponse.json({ error: "No project" }, { status: 400 });

  try {
    const proposed = await ingestAndPropose(project.id, [message]);
    const first = proposed[0];
    return NextResponse.json({
      ok: true,
      ingested: proposed.length,
      ids: proposed.map((p) => p.message?.id).filter(Boolean),
      extract: first?.extract || null,
    });
  } catch (err) {
    console.error("[whatsapp.webhook] ingest failed", err);
    // Still 200 so YCloud does not retry forever on LLM failures after persist
    return NextResponse.json({ ok: true, ingested: 0, error: "ingest_failed" });
  }
}
