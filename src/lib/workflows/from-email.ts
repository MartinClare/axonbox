import {
  persistNormalizedMessages,
  analyzeInboxMessage,
  processInboxToEventTask,
} from "@/lib/inbox";
import { extractFromInput } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

export type FromEmailInput = {
  from?: string;
  subject?: string;
  body?: string;
  text?: string;
  /** Base64 image (no data: prefix) for vision analysis */
  imageBase64?: string;
  imageMime?: string;
  /** Optional list of attachment descriptors or base64 images */
  attachments?: Array<{
    name?: string;
    mime?: string;
    base64?: string;
  }>;
  autoProcess?: boolean;
  userId: string;
  assigneeId?: string;
  subcontractorId?: string;
};

/**
 * Email / message → AI (text + vision) → Event + Task workflow
 */
export async function workflowFromEmail(input: FromEmailInput) {
  const project = await prisma.project.findFirst();
  if (!project) throw new Error("No project");

  const body = input.body || input.text || "";
  if (!body.trim() && !input.subject && !input.imageBase64) {
    throw new Error("body or image required");
  }

  const attachmentMeta = (input.attachments || []).map((a) => a.name || "attachment");
  if (input.imageBase64) attachmentMeta.push("inline-image");

  const [message] = await persistNormalizedMessages(project.id, [
    {
      channel: "EMAIL",
      sender: input.from || "mail@unknown",
      subject: input.subject || "（无主题）",
      body,
      attachments: attachmentMeta,
      receivedAt: new Date(),
      rawPayload: {
        from: input.from,
        subject: input.subject,
        hasImage: Boolean(input.imageBase64),
      },
    },
  ]);

  // Prefer first image attachment for vision
  let imageBase64 = input.imageBase64;
  let imageMime = input.imageMime || "image/jpeg";
  if (!imageBase64 && input.attachments?.length) {
    const img = input.attachments.find(
      (a) => a.base64 && (a.mime?.startsWith("image/") || !a.mime),
    );
    if (img?.base64) {
      imageBase64 = img.base64.replace(/^data:[^;]+;base64,/, "");
      imageMime = img.mime || "image/jpeg";
    }
  }

  const text = [
    input.subject ? `主题：${input.subject}` : "",
    body,
    "請將此郵件轉為可執行的工地事件與整改任務。",
  ]
    .filter(Boolean)
    .join("\n");

  const extract = await extractFromInput({
    text,
    imageBase64,
    imageMime,
    filename: `email-${input.from || "unknown"}`,
  });

  await prisma.inboxMessage.update({
    where: { id: message.id },
    data: {
      status: "ANALYZED",
      aiJson: JSON.stringify(extract),
      attachments: JSON.stringify(attachmentMeta),
    },
  });

  const autoProcess = input.autoProcess !== false;
  if (!autoProcess) {
    return {
      inboxId: message.id,
      extract,
      case: null,
      task: null,
      processed: false,
    };
  }

  // Ensure process uses fresh aiJson
  const result = await processInboxToEventTask({
    id: message.id,
    userId: input.userId,
    assigneeId: input.assigneeId,
    subcontractorId: input.subcontractorId,
    createTask: true,
  });

  return {
    inboxId: message.id,
    extract: result.extract,
    case: result.case,
    task: result.task,
    evidence: result.evidence,
    processed: true,
  };
}

/** Re-export analyze for attachment-aware analyze path */
export { analyzeInboxMessage };
