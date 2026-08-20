export type InboxActionItem = {
  title: string;
  detail?: string;
};

/** Bullet / numbered lines from the original message (minutes-style). */
export function parseInboxActionItems(text: string): InboxActionItem[] {
  const cleaned = String(text || "")
    .replace(/\[轉發\]/g, "\n")
    .replace(/主题：/g, "")
    .trim();
  if (!cleaned) return [];

  const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: InboxActionItem[] = [];
  for (const line of lines) {
    const m = line.match(/^(?:[-–—*•]|\d+[.)]|[a-z][.)])\s+(.+)/i);
    if (!m) continue;
    const title = m[1].replace(/[;；。]+$/g, "").trim();
    if (title.length < 4) continue;
    if (items.some((x) => x.title === title)) continue;
    items.push({ title: title.slice(0, 220) });
  }
  return items.slice(0, 12);
}

export function normalizeActionItems(raw: unknown): InboxActionItem[] {
  if (!Array.isArray(raw)) return [];
  const out: InboxActionItem[] = [];
  for (const item of raw) {
    if (typeof item === "string" && item.trim().length >= 4) {
      out.push({ title: item.trim().slice(0, 220) });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const row = item as { title?: string; detail?: string; text?: string };
    const title = String(row.title || row.text || "").trim();
    if (title.length < 4) continue;
    const detail = String(row.detail || "").trim();
    out.push({ title: title.slice(0, 220), ...(detail ? { detail: detail.slice(0, 500) } : {}) });
  }
  return out.slice(0, 12);
}

export function resolveInboxActionItems(
  extract: { actionItems?: InboxActionItem[]; recommendation?: string } | null | undefined,
  body: string,
): InboxActionItem[] {
  const fromAi = normalizeActionItems(extract?.actionItems);
  const fromText = parseInboxActionItems(body);
  if (fromAi.length >= 2) return fromAi;
  if (fromText.length >= 2) return fromText;
  if (fromAi.length) return fromAi;
  if (fromText.length) return fromText;
  const rec = String(extract?.recommendation || "").trim();
  if (rec.length >= 4) return [{ title: rec.slice(0, 220) }];
  return [];
}
