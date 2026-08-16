import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestAndPropose, processInboxToEventTask } from "@/lib/inbox";
import {
  inboundToNormalized,
  mailboxAlias,
  parseInboundRequest,
  verifyInboundSecret,
} from "@/lib/email-inbound";
import { resolveUserByMailbox } from "@/lib/inbound-key";

export const maxDuration = 60;

/**
 * Public inbound mailbox webhook.
 * Point SendGrid / Mailgun / Cloudflare / Resend / any email-to-webhook
 * at this URL. Default: persist + LLM proposed case. Approval creates the task.
 *
 * POST /api/connectors/email/webhook?token=INBOUND_WEBHOOK_SECRET
 */
export async function GET(req: Request) {
  if (!verifyInboundSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, inbound: true });
}

export async function POST(req: Request) {
  if (!verifyInboundSecret(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findFirst();
  if (!project) return NextResponse.json({ error: "No project" }, { status: 400 });

  const email = await parseInboundRequest(req);
  if (!email) {
    return NextResponse.json({
      ok: true,
      ingested: 0,
      hint: "POST { from, subject, body } or provider form payload",
    });
  }

  const mailbox = mailboxAlias(email.to);
  const inboundUser = await resolveUserByMailbox(mailbox || email.to);
  if (!inboundUser) {
    console.warn("[email.webhook] reject unknown mailbox", email.to || mailbox || "(empty)");
    return NextResponse.json({
      ok: true,
      ingested: 0,
      rejected: "unknown_mailbox",
      mailbox: mailbox || email.to || "",
    });
  }

  const autoProcess = process.env.EMAIL_AUTO_WORKFLOW === "true";
  const proposed = await ingestAndPropose(project.id, [inboundToNormalized(email)]);
  const first = proposed[0];

  if (autoProcess && first?.message?.id) {
    const admin = await prisma.user.findFirst({
      where: { role: { in: ["ADMIN", "OWNER"] } },
      orderBy: { createdAt: "asc" },
    });
    if (admin) {
      const result = await processInboxToEventTask({
        id: first.message.id,
        userId: admin.id,
        createTask: true,
      });
      return NextResponse.json({ ok: true, mode: "workflow", ...result });
    }
  }

  return NextResponse.json({
    ok: true,
    mode: "proposed",
    ingested: proposed.length,
    ids: proposed.map((p) => p.message?.id).filter(Boolean),
    extract: first?.extract || null,
  });
}
