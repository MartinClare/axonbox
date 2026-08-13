import { chatText, hasAIKey } from "@/lib/ai";
import { searchKnowledge, type KnowledgeDoc } from "./hyd-xpms";

export type AskMode = "official" | "general" | "hybrid";

export type AskResult = {
  answer: string;
  citations: Array<{
    title: string;
    source: string;
    page: string | number;
    section?: string;
    url: string;
  }>;
  docs: KnowledgeDoc[];
  mock: boolean;
  mode: AskMode;
};

const ASK_SYSTEM = `你是香港工地工程顧問。只用繁體中文。
強制規則：
- 總字數 80–160 字，絕不超過 200 字
- 結構：1–2 句結論 + 最多 4 條「· 」要點
- 禁止 Markdown（星號、井號、反引號）、表情、英文小標、長段、重複、思考過程
- XPMS／法規只根據提供摘錄；不可捏造條號頁碼
- 一般工程給可執行要點；不確定寫「需核對原文」`;

/** Strip markdown / noise so UI shows plain readable text */
export function cleanAskAnswer(raw: string): string {
  return String(raw || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/```[\s\S]*?```/g, (block) =>
      block.replace(/```\w*\n?/g, "").replace(/```/g, "").trim(),
    )
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[>\|]\s?/gm, "")
    .replace(/^\s*[-*]\s+/gm, "· ")
    .replace(/^\s*\d+[\.\)]\s+/gm, "· ")
    .replace(/[•●▪◦◆◇►▶]/g, "·")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function citationsFrom(docs: KnowledgeDoc[]) {
  return docs.slice(0, 3).map((d) => ({
    title: d.title,
    source: d.source,
    page: d.page,
    section: d.section,
    url: d.sourceUrl,
  }));
}

function compactContext(docs: KnowledgeDoc[]) {
  return docs
    .slice(0, 3)
    .map((d, i) => `[${i + 1}] ${d.title}｜${d.content}｜出處 p.${d.page}`)
    .join("\n");
}

function buildPrompt(question: string, docs: KnowledgeDoc[]): string {
  if (docs.length) {
    return `依官方摘錄作答；無關部分可給極短實務要點。出處已在系統顯示，正文不必重複長引用。

官方摘錄：
${compactContext(docs)}

問題：${question}

請嚴格照此格式（短）：
結論一句。
· 要點
· 要點`;
  }

  return `一般工程問題。短答、可執行。

問題：${question}

格式：
結論一句。
· 要點
· 要點`;
}

function shortFromDocs(docs: KnowledgeDoc[]): string {
  const top = docs[0];
  const second = docs[1];
  const a =
    top.content.length > 100 ? `${top.content.slice(0, 100)}…` : top.content;
  const lines = [`依官方資料：${a}`, `· 出處 p.${top.page}`];
  if (second) {
    const b =
      second.content.length > 70 ? `${second.content.slice(0, 70)}…` : second.content;
    lines.push(`· ${b}（p.${second.page}）`);
  }
  return cleanAskAnswer(lines.join("\n"));
}

/**
 * Engineering Q&A — concise plain-text answers; HyD/XPMS when matched.
 */
export async function askEngineering(question: string): Promise<AskResult> {
  const q = question.trim();
  const docs = searchKnowledge(q, 3);
  const citations = citationsFrom(docs);
  const mode: AskMode = docs.length ? "hybrid" : "general";

  if (!hasAIKey()) {
    if (docs.length) {
      return {
        answer: shortFromDocs(docs),
        citations,
        docs,
        mock: true,
        mode: "official",
      };
    }
    return {
      answer: cleanAskAnswer(
        "暫無法回答一般工程題（未設定 AI）。\n· XPMS：xpms.hyd.gov.hk\n· 支援：2762 3357",
      ),
      citations: [],
      docs: [],
      mock: true,
      mode: "general",
    };
  }

  const aiAnswer = await chatText(buildPrompt(q, docs), {
    temperature: 0.1,
    maxTokens: 280,
    system: ASK_SYSTEM,
  });

  if (aiAnswer) {
    return {
      answer: cleanAskAnswer(aiAnswer),
      citations,
      docs,
      mock: false,
      mode,
    };
  }

  if (docs.length) {
    return {
      answer: shortFromDocs(docs),
      citations,
      docs,
      mock: true,
      mode: "official",
    };
  }

  return {
    answer: cleanAskAnswer("AI 暫時無法連線，請稍後再試。\n· 可改問 XPMS、AN、短期工程"),
    citations: [],
    docs: [],
    mock: true,
    mode: "general",
  };
}
