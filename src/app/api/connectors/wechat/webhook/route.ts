import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { persistNormalizedMessages } from "@/lib/inbox";
import type { NormalizedInboxMessage } from "@/lib/connectors";

/**
 * WeChat Work / Official Account callback
 * INSERT: signature verify + XML/JSON decrypt
 * Env: WECHAT_APP_ID, WECHAT_APP_SECRET, WECHAT_TOKEN, WECHAT_ENCODING_AES_KEY
 *
 * Demo: POST { sender, text }
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    connector: "wechat",
    mode: "stub",
    hint: "Configure WECHAT_* env and implement signature + message decrypt here",
  });
}

export async function POST(req: Request) {
  const project = await prisma.project.findFirst();
  if (!project) return NextResponse.json({ error: "No project" }, { status: 400 });

  const payload = await req.json().catch(() => ({}));

  // INSERT: parse WeChat encrypted XML / event payload
  const messages: NormalizedInboxMessage[] = [];
  if (payload.text || payload.body || payload.Content) {
    messages.push({
      channel: "WECHAT",
      externalId: payload.MsgId || payload.id,
      sender: payload.sender || payload.FromUserName || "微信用戶",
      body: payload.text || payload.body || payload.Content || "",
      receivedAt: new Date(),
      rawPayload: payload,
    });
  }

  if (!messages.length) {
    return NextResponse.json({
      ok: true,
      ingested: 0,
      hint: "INSERT WeChat decrypt; or POST { sender, text } for demo",
    });
  }

  const created = await persistNormalizedMessages(project.id, messages);
  return NextResponse.json({ ok: true, ingested: created.length, ids: created.map((c) => c.id) });
}
