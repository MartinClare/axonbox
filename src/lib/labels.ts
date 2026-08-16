export const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "\u90f5\u4ef6",
  WECHAT: "\u5fae\u4fe1",
  MANUAL: "\u624b\u52d5\u8f38\u5165",
};

export const INBOX_STATUS_LABELS: Record<string, string> = {
  PENDING: "\u5f85\u5206\u6790",
  ANALYZED: "\u5f85\u6838\u51c6",
  PROCESSED: "\u5df2\u5efa\u4efb\u52d9",
  DISMISSED: "\u5df2\u5ffd\u7565",
};

/** Product domain: Case entity is shown as \u4e8b\u4ef6 in UI */
export const EVENT_LABEL = "\u4e8b\u4ef6";

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "\u4f01\u696d\u64c1\u6709\u4eba",
  ADMIN: "\u7ba1\u7406\u54e1",
  SUPERVISOR: "\u73fe\u5834\u4e3b\u7ba1",
  VIEWER: "\u552f\u8b80\u6210\u54e1",
  SUBCONTRACTOR: "\u5206\u5224\u4eba\u54e1",
};

export const TRADE_OPTIONS = [
  "\u5b89\u5168\u9632\u8b77",
  "\u92fc\u7b4b",
  "\u6a21\u677f",
  "\u6df7\u51dd\u571f",
  "\u96fb\u6c23",
  "\u6c34\u96fb",
  "\u74b0\u4fdd\u6e05\u6f54",
  "\u5718\u968a\u5de5\u7a0b",
  "\u5176\u4ed6",
];

export const CATEGORY_LABELS: Record<string, string> = {
  SAFETY: "\u5b89\u5168",
  QUALITY: "\u8cea\u91cf",
  PROGRESS: "\u9032\u5ea6",
  ENVIRONMENT: "\u74b0\u5883",
  OTHER: "\u5176\u4ed6",
};

export const SEVERITY_LABELS: Record<string, string> = {
  HIGH: "\u9ad8",
  MEDIUM: "\u4e2d",
  LOW: "\u4f4e",
};

export const CASE_STATUS_LABELS: Record<string, string> = {
  OPEN: "\u5f85\u8655\u7406",
  ASSIGNED: "\u5df2\u6307\u6d3e",
  IN_PROGRESS: "\u9032\u884c\u4e2d",
  PENDING_REVIEW: "\u5f85\u6838\u9a57",
  CLOSED: "\u5df2\u5b8c\u6210",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  PENDING: "\u5f85\u8655\u7406",
  IN_PROGRESS: "\u9032\u884c\u4e2d",
  PENDING_REVIEW: "\u5f85\u6838\u9a57",
  DONE: "\u5df2\u5b8c\u6210",
};

export const EVIDENCE_STATUS_LABELS: Record<string, string> = {
  PENDING: "\u5f85\u8655\u7406",
  IN_PROGRESS: "\u8655\u7406\u4e2d",
  HANDLED: "\u5df2\u8655\u7406",
};

export const CATEGORY_COLORS: Record<string, string> = {
  SAFETY: "bg-[rgba(214,40,40,0.12)] text-[var(--axon-danger)]",
  QUALITY: "bg-[rgba(247,127,0,0.14)] text-[var(--axon-accent)]",
  PROGRESS: "bg-[rgba(0,48,73,0.1)] text-[var(--axon-ink)]",
  ENVIRONMENT: "bg-[rgba(254,206,50,0.35)] text-[var(--axon-ink)]",
  OTHER: "bg-[rgba(0,48,73,0.06)] text-[var(--axon-steel)]",
};

export const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-[rgba(214,40,40,0.12)] text-[var(--axon-danger)]",
  ASSIGNED: "bg-[rgba(247,127,0,0.16)] text-[var(--axon-accent)]",
  IN_PROGRESS: "bg-[rgba(0,48,73,0.1)] text-[var(--axon-ink)]",
  PENDING_REVIEW: "bg-[rgba(254,206,50,0.4)] text-[var(--axon-ink)]",
  CLOSED: "bg-[rgba(31,107,74,0.12)] text-[var(--axon-ok)]",
  PENDING: "bg-[rgba(214,40,40,0.12)] text-[var(--axon-danger)]",
  DONE: "bg-[rgba(31,107,74,0.12)] text-[var(--axon-ok)]",
  HANDLED: "bg-[rgba(31,107,74,0.12)] text-[var(--axon-ok)]",
};

export const SEVERITY_COLORS: Record<string, string> = {
  HIGH: "text-[var(--axon-danger)]",
  MEDIUM: "text-[var(--axon-accent)]",
  LOW: "text-[var(--axon-steel)]",
};

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "\u2014";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(d: Date | string | null | undefined) {
  if (!d) return "\u2014";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("zh-HK");
}

export function daysRemaining(dueAt: Date | string | null | undefined) {
  if (!dueAt) return null;
  const due = typeof dueAt === "string" ? new Date(dueAt) : dueAt;
  const ms = due.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
