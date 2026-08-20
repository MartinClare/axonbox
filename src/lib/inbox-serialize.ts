import { mailboxAlias } from "@/lib/email-inbound";
import {
  isAudioFile,
  isDocumentFile,
  isImageFile,
  parseInboxAttachments,
} from "@/lib/inbound-files";

export type InboxFileView = {
  name: string;
  mime: string;
  kind: "image" | "audio" | "doc" | "file";
  url: string;
  dataUrl?: string;
};

export type InboxListItem = {
  id: string;
  channel: string;
  sender: string;
  subject: string | null;
  body: string;
  status: string;
  aiJson: string | null;
  receivedAt: Date | string;
  updatedAt?: Date | string;
  case?: { id: string; caseNo: string; title: string; status: string } | null;
  mailbox: string;
  forwardedByName: string | null;
  fromEmail: string;
  fileCount: number;
  hasImage: boolean;
  files: InboxFileView[];
};

type InboxRecord = {
  id: string;
  channel: string;
  sender: string;
  subject: string | null;
  body: string;
  status: string;
  aiJson: string | null;
  receivedAt: Date;
  updatedAt?: Date;
  rawPayload?: string | null;
  attachments?: string | null;
  case?: { id: string; caseNo: string; title: string; status: string } | null;
  forwardedBy?: { id: string; name: string; inboundKey: string | null } | null;
};

function mailboxFromRaw(rawPayload?: string | null) {
  if (!rawPayload) return "";
  try {
    const raw = JSON.parse(rawPayload) as { mailbox?: string; to?: string; receivedFor?: string };
    return raw.mailbox || mailboxAlias(raw.to || raw.receivedFor);
  } catch {
    return "";
  }
}

function fromFromRaw(rawPayload?: string | null) {
  if (!rawPayload) return "";
  try {
    const raw = JSON.parse(rawPayload) as { from?: string };
    return raw.from || "";
  } catch {
    return "";
  }
}

function fileKind(file: { mime?: string; name?: string }): InboxFileView["kind"] {
  if (isImageFile(file)) return "image";
  if (isAudioFile(file)) return "audio";
  if (isDocumentFile(file)) return "doc";
  return "file";
}

export function serializeInboxMessage(
  m: InboxRecord,
  opts?: { includeFileData?: boolean },
): InboxListItem {
  const stored = parseInboxAttachments(m.attachments);
  const files: InboxFileView[] = stored.map((f, i) => {
    const kind = fileKind(f);
    const includeData = Boolean(opts?.includeFileData) && (kind === "image" || kind === "audio");
    return {
      name: f.name,
      mime: f.mime,
      kind,
      url: `/api/inbox/${m.id}/files/${i}`,
      ...(includeData ? { dataUrl: `data:${f.mime};base64,${f.base64}` } : {}),
    };
  });

  return {
    id: m.id,
    channel: m.channel,
    sender: m.sender,
    subject: m.subject,
    body: m.body,
    status: m.status,
    aiJson: m.aiJson,
    receivedAt: m.receivedAt,
    updatedAt: m.updatedAt,
    case: m.case || null,
    mailbox: mailboxFromRaw(m.rawPayload) || m.forwardedBy?.inboundKey || "",
    forwardedByName: m.forwardedBy?.name || null,
    fromEmail: fromFromRaw(m.rawPayload),
    fileCount: files.length,
    hasImage: files.some((f) => f.kind === "image"),
    files,
  };
}
