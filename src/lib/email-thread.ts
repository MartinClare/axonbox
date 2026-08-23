/** Split a forwarded / replied-to email so the newest message is primary. */

const HEADER_SPLIT =
  /(?:^|\n)(?=(?:From|寄件者)\s*:\s*.+\r?\n(?:Sent|Date|日期|寄件日期)\s*:)/gim;
const ORIGINAL_SPLIT =
  /(?:^|\n)(?=-{3,}\s*(?:Original Message|原始郵件|原始邮件)\s*-{3,})/gim;
const ON_WROTE_SPLIT = /(?:^|\n)(?=On .{8,200} wrote:\s*(?:\n|$))/gim;
const ZH_WROTE_SPLIT = /(?:^|\n)(?=在.{4,80}寫道[：:])/gim;
const RULE_SPLIT = /(?:^|\n)(?=_{10,}\s*(?:\n|$))/g;

function splitIndexes(text: string): number[] {
  const found = new Set<number>();
  for (const re of [HEADER_SPLIT, ORIGINAL_SPLIT, ON_WROTE_SPLIT, ZH_WROTE_SPLIT, RULE_SPLIT]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text))) {
      let i = match.index;
      if (text[i] === "\n") i += 1;
      if (i > 0) found.add(i);
      // Lookahead-only matches are empty; advance or exec() loops forever.
      if (!match[0]) re.lastIndex = match.index + 1;
    }
  }
  return [...found].sort((a, b) => a - b);
}

function stripQuotedHeader(part: string) {
  return part
    .replace(/^(?:From|寄件者)\s*:[\s\S]*?\n(?:Subject|主旨)\s*:[^\n]*\n+/i, "")
    .replace(/^-{3,}\s*(?:Original Message|原始郵件|原始邮件)\s*-{3,}[^\n]*\n+/i, "")
    .replace(/^On .{8,200} wrote:\s*\n+/i, "")
    .replace(/^在.{4,80}寫道[：:][^\n]*\n+/i, "")
    .trim();
}

function meaningfulText(text: string) {
  return text
    .replace(/<[^>\n]+\.(pdf|docx?|xlsx?|png|jpe?g|gif)>/gi, " ")
    .replace(/\[Picture[^\]]*\]/gi, " ")
    .replace(/\[cid:[^\]]+\]/gi, " ")
    .split("\n")
    .filter((line) => {
      const l = line.trim();
      if (!l) return false;
      if (/^(thanks?(?:\s+and\s+regards)?|thank you(?:\s+and\s+regards)?|best regards|regards|cheers|sent from my|謝謝|此致|祝好)\b/i.test(l)) {
        return false;
      }
      if (/^(from|sent|date|to|cc|subject|寄件者|寄件日期|日期|收件者|副本|主旨)\s*:/i.test(l)) {
        return false;
      }
      if (/^(tel|fax|office|email|homepage|website|mobile|電話|傳真|電郵)\b/i.test(l)) return false;
      if (/^[tf]\s*:\s*\d/i.test(l)) return false;
      if (/https?:\/\//i.test(l) && l.length < 120) return false;
      if (/@(?:axonhk|techoy|thelloy|gmail|outlook)\./i.test(l) && l.length < 90) return false;
      if (/\b(Science Park|Industrial Building|To Kwa Wan|Shatin|Kowloon)\b/i.test(l)) return false;
      if (/^(unit|11\/f|member of)\b/i.test(l)) return false;
      return true;
    })
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

export function isThinEmailPart(text: string) {
  const core = meaningfulText(text)
    .replace(/\b(if you have any questions|please feel free to contact|please see below|see below|as below|fyi|for your (info|information|action)|轉寄如下|請參閱以下)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return core.length < 80;
}

export function splitEmailThread(text: string): { latest: string; history: string } {
  const raw = (text || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return { latest: "", history: "" };

  const cuts = splitIndexes(raw);
  if (cuts.length === 0) return { latest: raw, history: "" };

  const parts: string[] = [];
  let start = 0;
  for (const cut of cuts) {
    const chunk = raw.slice(start, cut).trim();
    if (chunk) parts.push(chunk);
    start = cut;
  }
  const tail = raw.slice(start).trim();
  if (tail) parts.push(tail);
  if (parts.length <= 1) return { latest: raw, history: "" };

  let latestIdx = 0;
  while (latestIdx < parts.length - 1) {
    const candidate = stripQuotedHeader(parts[latestIdx]) || parts[latestIdx];
    if (!isThinEmailPart(candidate)) break;
    latestIdx += 1;
  }

  const latest = stripQuotedHeader(parts[latestIdx]) || parts[latestIdx];
  const history = parts
    .slice(latestIdx + 1)
    .map((p) => stripQuotedHeader(p) || p)
    .filter(Boolean)
    .join("\n\n---\n\n");

  return {
    latest: latest.trim() || raw,
    history: history.trim(),
  };
}

export function emailAnalysisParts(subject: string, body: string) {
  const { latest, history } = splitEmailThread(body);
  const focus = latest.trim() || body.trim();
  return {
    latest: focus,
    history,
    text: [subject ? `主题：${subject}` : "", "【最新回覆】", focus].filter(Boolean).join("\n"),
    usedThread: Boolean(history),
  };
}
