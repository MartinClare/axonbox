import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { persistNormalizedMessages } from "@/lib/inbox";
import { workflowFromEmail } from "@/lib/workflows/from-email";
import type { NormalizedInboxMessage } from "@/lib/connectors";

/**
 * Email inbound webhook
 * Demo: POST { from, subject, body, imageBase64?, autoProcess? }
 *
 * Set EMAIL_AUTO_WORKFLOW=true to always AI→Event→Task.
 * Or pass autoProcess:true in body.
 */
export async function POST(req: Request) {
  const project = await prisma.project.findFirst();
  if (!project) return NextResponse.json({ error: "No project" }, { status: 400 });

  const payload = await req.json().catch(() => ({}));

  const auto =
    payload.autoProcess === true ||
    process.env.EMAIL_AUTO_WORKFLOW === "true";

  if (auto && (payload.body || payload.text || payload.subject || payload.imageBase64)) {
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
    });
    if (!admin) {
      return NextResponse.json({ error: "No admin user for actor" }, { status: 400 });
    }
    try {
      const result = await workflowFromEmail({
        from: payload.from,
        subject: payload.subject,
        body: payload.body || payload.text,
        imageBase64: payload.imageBase64,
        imageMime: payload.imageMime,
        attachments: payload.attachments,
        autoProcess: true,
        userId: admin.id,
      });
      return NextResponse.json({ ok: true, mode: "workflow", ...result });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "workflow failed" },
        { status: 400 },
      );
    }
  }

  const messages: NormalizedInboxMessage[] = [];
  if (payload.from || payload.subject || payload.body || payload.text) {
    messages.push({
      channel: "EMAIL",
      externalId: payload.id || payload.messageId,
      sender: payload.from || "mail@unknown",
      subject: payload.subject || "（无主题）",
      body: payload.body || payload.text || "",
      attachments: payload.attachments || [],
      receivedAt: payload.receivedAt ? new Date(payload.receivedAt) : new Date(),
      rawPayload: payload,
    });
  }

  if (!messages.length) {
    return NextResponse.json({
      ok: true,
      ingested: 0,
      hint: "POST { from, subject, body, autoProcess:true } for AI workflow",
    });
  }

  const created = await persistNormalizedMessages(project.id, messages);
  return NextResponse.json({
    ok: true,
    mode: "inbox",
    ingested: created.length,
    ids: created.map((c) => c.id),
  });
}
