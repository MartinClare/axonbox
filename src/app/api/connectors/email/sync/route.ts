import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { ingestAndPropose } from "@/lib/inbox";
import { fetchUnseenInboundEmails } from "@/lib/email-imap";
import {
  inboundImapConfigured,
  inboundResendConfigured,
  inboundToNormalized,
} from "@/lib/email-inbound";
import { fetchResendReceivedEmails } from "@/lib/resend-inbound";
import type { NormalizedInboxMessage } from "@/lib/connectors";

export const maxDuration = 60;

/**
 * Pull new inbound mail (Resend Receiving and/or IMAP), then LLM-propose cases.
 * POST /api/connectors/email/sync
 */
export async function POST() {
  const { error } = await requireSession();
  if (error) return error;

  const canResend = inboundResendConfigured();
  const canImap = inboundImapConfigured();
  if (!canResend && !canImap) {
    return NextResponse.json(
      { error: "尚未設定 Resend 或 IMAP 收件" },
      { status: 400 },
    );
  }

  const project = await prisma.project.findFirst();
  if (!project) return NextResponse.json({ error: "No project" }, { status: 400 });

  try {
    const messages: NormalizedInboxMessage[] = [];
    if (canResend) {
      const received = await fetchResendReceivedEmails();
      messages.push(...received.map(inboundToNormalized));
    }
    if (canImap) {
      messages.push(...(await fetchUnseenInboundEmails()));
    }
    const proposed = await ingestAndPropose(project.id, messages);
    return NextResponse.json({
      ok: true,
      pulled: messages.length,
      proposed: proposed.length,
      ids: proposed.map((p) => p.message?.id).filter(Boolean),
    });
  } catch (e) {
    console.error("[email.sync]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Email sync failed" },
      { status: 400 },
    );
  }
}
