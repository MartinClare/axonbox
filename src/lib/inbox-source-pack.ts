export const SOURCE_PACK_MARK = "【來源資料】";

export function withSourcePack(summary: string, pack: string) {
  const head = (summary || "").trim();
  const body = (pack || "").trim();
  if (!body) return head;
  if (head.includes(SOURCE_PACK_MARK)) return head;
  if (!head) return `${SOURCE_PACK_MARK}\n${body}`;
  return `${head}\n\n${SOURCE_PACK_MARK}\n${body}`;
}

export function splitSourcePack(text: string | null | undefined) {
  const raw = text || "";
  const i = raw.indexOf(SOURCE_PACK_MARK);
  if (i < 0) return { summary: raw, source: "" };
  return {
    summary: raw.slice(0, i).trim(),
    source: raw.slice(i + SOURCE_PACK_MARK.length).trim(),
  };
}
