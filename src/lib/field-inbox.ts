export type FieldInboxFile = {
  name: string;
  mime: string;
  kind: "image" | "audio" | "doc" | "file";
  url?: string;
  dataUrl?: string;
};

export type FieldInboxRow = {
  id: string;
  channel: string;
  sender: string;
  subject: string | null;
  body: string;
  status: string;
  aiJson: string | null;
  receivedAt: string;
  fileCount?: number;
  hasImage?: boolean;
  files?: FieldInboxFile[];
  case?: { id: string; caseNo: string; title: string; status: string } | null;
};

export function inboxFileSrc(f: FieldInboxFile, messageId: string, index: number) {
  return f.url || f.dataUrl || `/api/inbox/${messageId}/files/${index}`;
}

export function inboxSnippet(row: FieldInboxRow) {
  const text = (row.subject || row.body || "").replace(/^\[轉發\]\s*/m, "").trim();
  return text.replace(/\s+/g, " ").slice(0, 90);
}

export function waitingInbox(rows: FieldInboxRow[]) {
  return rows.filter((r) => r.status === "PENDING" || r.status === "ANALYZED");
}
