import type OpenAI from "openai";
import { getAIClient, getAIModel, hasAIKey, hasOpenAIKey } from "./ai-client";

import { parseInboxActionItems, normalizeActionItems, type InboxActionItem } from "./inbox-actions";

export type CaseCategory = "SAFETY" | "QUALITY" | "PROGRESS" | "ENVIRONMENT" | "OTHER";
export type Severity = "HIGH" | "MEDIUM" | "LOW";

export type SiteFinding = {
  type: "SAFETY_GAP" | "QUALITY_DEFECT" | "PROGRESS" | "ENVIRONMENT" | "OTHER";
  label: string;
  detail: string;
  severity: Severity;
};

export type ExtractResult = {
  title: string;
  description: string;
  category: CaseCategory;
  severity: Severity;
  location: string;
  recommendation: string;
  suggestedAssigneeRole: string;
  progressPct: number;
  workActivity: string;
  findings: SiteFinding[];
  siteSummary: string;
  confidence: number;
  mock: boolean;
  model?: string;
  tags: string[];
  analysisMode: "record" | "discover";
  actionItems: InboxActionItem[];
};

export { hasAIKey, hasOpenAIKey, getAIModel };

const CATEGORIES: CaseCategory[] = [
  "SAFETY",
  "QUALITY",
  "PROGRESS",
  "ENVIRONMENT",
  "OTHER",
];

function normalizeTags(raw: unknown, extras: string[] = []): string[] {
  const fromAi = Array.isArray(raw)
    ? raw
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.replace(/^#/, "").trim())
        .filter(Boolean)
    : [];
  const out: string[] = [];
  for (const t of [...extras, ...fromAi]) {
    if (t && !out.includes(t)) out.push(t);
  }
  return out.slice(0, 12);
}

const SITE_INVENTION =
  /圍欄|護欄|圍板|開挖|挖掘|洞口|鋼筋|裂縫|xpms|hyd|許可證|道路挖掘|警示燈|高空作業|臨時交通|公共道路/i;
const PAPERWORK_INVENTION = /xpms|hyd|xp申請|挖掘許可|an申請|道路挖掘許可/i;

function sourceLooksThin(text?: string) {
  const t = (text || "")
    .replace(/\[轉發\]/g, "")
    .replace(/\[圖片\]/g, "")
    .replace(/\[語音\]/g, "")
    .replace(/\[文件\]/g, "")
    .replace(/主题：/g, "")
    .trim();
  return t.length < 80;
}

function groundedFallback(text?: string): ExtractResult {
  const line = (text || "")
    .replace(/\[轉發\]\s*/g, "")
    .replace(/主题：/g, "")
    .trim()
    .slice(0, 120);
  const title = line || "待補充的現場訊息";
  return {
    title,
    description: line || "訊息過短，無法判斷具體現場問題。",
    category: "OTHER",
    severity: "LOW",
    location: "待確認",
    recommendation: "請補充現場照片或原文詳情後再核准；不要把此則當成已確認的安全事故。",
    suggestedAssigneeRole: "SUPERVISOR",
    progressPct: 0,
    workActivity: "待確認",
    findings: [],
    siteSummary: "僅有簡短訊息，尚未構成可執行個案。",
    confidence: 0.2,
    mock: false,
    tags: ["待補充"],
    analysisMode: "discover",
    actionItems: parseInboxActionItems(text || ""),
  };
}

function extractDriftsFromSource(
  extract: ExtractResult,
  source: string,
  hasImage: boolean,
): boolean {
  const blob = [extract.title, extract.description, extract.siteSummary, extract.recommendation, extract.location]
    .filter(Boolean)
    .join("\n");
  if (PAPERWORK_INVENTION.test(blob) && !PAPERWORK_INVENTION.test(source)) return true;
  if (hasImage) return false;
  return SITE_INVENTION.test(blob) && !SITE_INVENTION.test(source);
}

function mockExtract(
  text?: string,
  filename?: string,
  analysisMode: "record" | "discover" = "discover",
): ExtractResult {
  const blob = `${text || ""} ${filename || ""}`.toLowerCase();
  if (sourceLooksThin(text) && !SITE_INVENTION.test(blob)) {
    return { ...groundedFallback(text), mock: true };
  }
  let category: CaseCategory = "OTHER";
  let severity: Severity = "MEDIUM";
  let title = analysisMode === "record" ? "現場現況記錄" : "現場狀況需跟進";
  let location = "地盤區域待確認";
  let recommendation =
    analysisMode === "record" ? "可作進度／存檔參考，無需強制整改" : "請現場主管核查並安排整改";
  let progressPct = 55;
  let workActivity = "模板／鋼筋作業";
  let findings: SiteFinding[] = [];
  let siteSummary =
    analysisMode === "record"
      ? "已記錄現場可見施工狀態（Mock）"
      : "已識別現場照片，建議人工確認關鍵細節";
  let tags = ["現場"];

  if (analysisMode === "record") {
    category = "PROGRESS";
    severity = "LOW";
    if (/鋼筋|钢筋|rebar/.test(blob)) {
      title = "現況：鋼筋綁紮作業中";
      workActivity = "鋼筋";
      progressPct = 48;
      tags = ["記錄", "鋼筋", "進度"];
    } else if (/混凝土|concrete|澆築|浇筑/.test(blob)) {
      title = "現況：混凝土澆築／養護";
      workActivity = "混凝土";
      progressPct = 60;
      tags = ["記錄", "混凝土", "進度"];
    } else {
      tags = ["記錄", "進度", "現場"];
      findings = [];
    }
    siteSummary = "目視記錄現場工序與進度，非缺陷通報";
  } else if (/安全|safety|圍欄|护栏|護欄|helmet|防護|防护|高空|洞口|opening|fence/.test(blob)) {
    category = "SAFETY";
    severity = "HIGH";
    title = "安全漏洞：邊緣防護不足";
    recommendation = "立即補設安全圍欄／洞口封閉，限制人員進入，並通知分判商整改";
    location = "B區 - 5樓平台";
    progressPct = 62;
    workActivity = "模板作業";
    tags = ["發現", "安全", "圍欄", "B區"];
    findings = [
      {
        type: "SAFETY_GAP",
        label: "缺少安全圍欄",
        detail: "平台邊緣未見有效防墜護欄",
        severity: "HIGH",
      },
      {
        type: "SAFETY_GAP",
        label: "洞口風險",
        detail: "可能存在未封閉洞口或臨時開口",
        severity: "HIGH",
      },
    ];
    siteSummary = "識別到高風險安全漏洞，建議優先整改";
  } else if (/質量|质量|quality|鋼筋|钢筋|混凝土|裂縫|裂缝|外露/.test(blob)) {
    category = "QUALITY";
    severity = "HIGH";
    title = "質量缺陷：結構細節需補強";
    recommendation = "安排質檢複核，按規範修復後拍照複核";
    location = "A區 - 3樓";
    progressPct = 48;
    workActivity = "鋼筋／混凝土";
    tags = ["發現", "質量", "鋼筋"];
    findings = [
      {
        type: "QUALITY_DEFECT",
        label: "鋼筋外露／結構缺陷",
        detail: "目視可能存在鋼筋保護層不足或混凝土缺陷",
        severity: "HIGH",
      },
    ];
    siteSummary = "識別到質量風險點，需質檢確認";
  } else if (/進度|进度|progress|延誤|延误|完工|完成/.test(blob)) {
    category = "PROGRESS";
    severity = "MEDIUM";
    title = "進度記錄：施工狀態更新";
    recommendation = "更新進度計劃並知會項目經理";
    location = "主樓施工區";
    progressPct = 68;
    workActivity = "結構／外牆";
    tags = ["發現", "進度"];
    findings = [
      {
        type: "PROGRESS",
        label: "進度約 68%",
        detail: "依照片目視估算，主體作業進行中",
        severity: "LOW",
      },
    ];
    siteSummary = "現場進度顯著，建議對照計劃核對";
  } else if (text || filename) {
    category = "SAFETY";
    severity = "MEDIUM";
    title = "現場照片已分析";
    tags = ["發現", "現場"];
    findings = [
      {
        type: "PROGRESS",
        label: "進度約 55%",
        detail: "依目視估算施工進度（Mock）",
        severity: "LOW",
      },
    ];
    siteSummary = "照片已接收；設定 OpenRouter 後可做真實視覺識別";
  }

  return {
    title,
    description:
      text?.slice(0, 200) ||
      `根據現場照片自動分析：${title}。${siteSummary}`,
    category,
    severity,
    location,
    recommendation,
    suggestedAssigneeRole: "SUPERVISOR",
    progressPct,
    workActivity,
    findings,
    siteSummary,
    confidence: 0.55,
    mock: true,
    tags: normalizeTags(tags),
    analysisMode,
    actionItems: parseInboxActionItems(text || ""),
  };
}

function parseJsonLoose(raw: string): Partial<ExtractResult> & {
  findings?: SiteFinding[];
  tags?: string[];
} {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]);
  } catch {
    return {};
  }
}

function normalizeExtract(
  parsed: Partial<ExtractResult> & { findings?: SiteFinding[]; tags?: string[] },
  input: { text?: string },
  model: string,
  analysisMode: "record" | "discover",
): ExtractResult {
  const category = CATEGORIES.includes(parsed.category as CaseCategory)
    ? (parsed.category as CaseCategory)
    : analysisMode === "record"
      ? "PROGRESS"
      : "OTHER";
  const severity =
    parsed.severity === "HIGH" ||
    parsed.severity === "MEDIUM" ||
    parsed.severity === "LOW"
      ? parsed.severity
      : analysisMode === "record"
        ? "LOW"
        : "MEDIUM";

  const findings = Array.isArray(parsed.findings)
    ? parsed.findings.map((f) => ({
        type: f.type || "OTHER",
        label: f.label || "發現",
        detail: f.detail || "",
        severity:
          f.severity === "HIGH" || f.severity === "MEDIUM" || f.severity === "LOW"
            ? f.severity
            : ("MEDIUM" as Severity),
      }))
    : [];

  const modeTag = analysisMode === "record" ? "記錄" : "發現";

  return {
    title: parsed.title || (analysisMode === "record" ? "現場現況記錄" : "現場分析"),
    description: parsed.description || input.text || "AI 已完成場地分析",
    category,
    severity,
    location: parsed.location || "地盤區域待確認",
    recommendation:
      parsed.recommendation ||
      (analysisMode === "record" ? "可作存檔／進度參考" : "請安排跟進"),
    suggestedAssigneeRole: parsed.suggestedAssigneeRole || "SUPERVISOR",
    progressPct: Math.min(100, Math.max(0, Number(parsed.progressPct) || 50)),
    workActivity: parsed.workActivity || "現場作業",
    findings: analysisMode === "record" ? findings.slice(0, 3) : findings,
    siteSummary: parsed.siteSummary || parsed.description || "",
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.7)),
    mock: false,
    model,
    tags: normalizeTags(parsed.tags, [modeTag]),
    analysisMode,
    actionItems: (() => {
      const fromAi = normalizeActionItems(
        (parsed as ExtractResult & { actionItems?: InboxActionItem[] }).actionItems,
      );
      return fromAi.length ? fromAi : parseInboxActionItems(input.text || "");
    })(),
  };
}

export async function extractFromInput(input: {
  text?: string;
  imageBase64?: string;
  imageMime?: string;
  filename?: string;
  mode?: "site" | "email" | "whatsapp";
  analysisMode?: "record" | "discover";
  documentNote?: string;
}): Promise<ExtractResult> {
  const analysisMode = input.analysisMode === "record" ? "record" : "discover";
  const hasImage = Boolean(input.imageBase64);
  const source = `${input.text || ""} ${input.filename || ""} ${input.documentNote || ""}`;

  if (!hasAIKey()) {
    const mock = mockExtract(input.text, input.filename, analysisMode);
    return extractDriftsFromSource(mock, source, hasImage) ? groundedFallback(input.text) : mock;
  }

  const model = getAIModel();
  const emailRules =
    input.mode === "email"
      ? `
這是一封轉寄到 AxonCase 的郵件。必須以郵件主旨與正文判斷個案。
- 不要把 PDF／Word 全文、條款或工作清單寫進 description 或 recommendation。
- 若有「附件摘錄」，只用來確認這是什麼個案（標題、類別、地點、嚴重度）。最多在 description 加一句「附件為…」。
- 不要執行或展開附件裡提到的所有事項。
`
      : "";
  const whatsappRules =
    input.mode === "whatsapp"
      ? `
這是 WhatsApp 轉發收件。必須以訊息正文（及照片，如有）判斷個案。
- 短訊／「有 comment／請跟進／RMO」之類：title 用原意改寫，category=OTHER，findings=[]。
- 沒有照片時，禁止描述圍欄、開挖、洞口、道路、HyD、XPMS 或任何未在文字出現的現場。
- 不要發明巡檢清單。但原文若已用項目符號、編號或分號列出多個要求，必須全部寫進 actionItems，不可合併成一項。
`
      : "";
  const docNote = input.documentNote
    ? `\n附件摘錄（僅供判斷主題，勿寫進個案正文）：\n${input.documentNote}\n`
    : "";

  const recordRules = `
模式：記錄現況（Record）。只描述照片／文字中「看得見的現況」，不要虛構安全或質量缺陷。
- findings 可為空陣列，或只列客觀觀察（非必改缺陷）
- severity 通常 LOW 或 MEDIUM
- recommendation 為可選備註／存檔建議，不要寫「立即整改」
- category 偏向 PROGRESS 或 OTHER（除非文字明確是其他類）
`;
  const discoverRules = `
模式：發現問題（Discover）。僅當文字或照片明確顯示缺陷時才列 findings。
沒有明確缺陷時：category=OTHER，severity=LOW，findings=[]，title／description 必須貼近原文。
禁止主動套用巡檢清單（圍欄、洞口、鋼筋、HyD、XPMS、公共道路挖掘）。除非原文或照片清楚出現，否則不要寫這些。
`;

  try {
    const client = getAIClient();
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      {
        type: "text",
        text: `你是 AxonCase 收件分析助手。只根據用戶提供的文字與照片作答，不要用工地常識補完不存在的事故。
${emailRules}${whatsappRules}${analysisMode === "record" ? recordRules : discoverRules}
只回傳純 JSON，文字必須使用繁體中文：
{
  "title":"一句話標題（必須反映原文）",
  "description":"根據原文／照片的摘要，不要添加未出現的情節",
  "category":"SAFETY|QUALITY|PROGRESS|ENVIRONMENT|OTHER",
  "severity":"HIGH|MEDIUM|LOW",
  "location":"原文有才填，否則待確認",
  "recommendation":"具體下一步或請對方補充",
  "suggestedAssigneeRole":"SUPERVISOR|SUBCONTRACTOR",
  "progressPct":0到100的整數,
  "workActivity":"主要工序或待確認",
  "siteSummary":"一句話，必須能對回原文",
  "confidence":0到1,
  "tags":["短標籤1","短標籤2"],
  "findings":[{"type":"SAFETY_GAP|QUALITY_DEFECT|PROGRESS|ENVIRONMENT|OTHER","label":"短標籤","detail":"具體說明","severity":"HIGH|MEDIUM|LOW"}],
  "actionItems":[{"title":"一項跟進","detail":"可選補充"}]
}
actionItems：把原文裡每一個獨立要求／項目符號／編號項各列一筆，語言跟隨原文，不要翻譯、不要合併、不要發明原文沒有的事項。只有一項要求時也可只列 1 筆。
tags：3～8 個短繁中標籤，必須來自原文或照片，不要加 #。
文字補充：${input.text || "(無)"}${docNote}`,
      },
    ];
    if (input.imageBase64) {
      content.push({
        type: "image_url",
        image_url: {
          url: `data:${input.imageMime || "image/jpeg"};base64,${input.imageBase64}`,
        },
      });
    }

    const res = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content }],
      temperature: analysisMode === "record" ? 0.15 : 0.2,
    });
    const raw = res.choices[0]?.message?.content || "";
    const parsed = parseJsonLoose(raw);
    if (!parsed.title && !parsed.description && !parsed.findings?.length) {
      throw new Error(`Empty AI response: ${raw.slice(0, 200)}`);
    }
    const extract = normalizeExtract(parsed, input, model, analysisMode);
    if (extractDriftsFromSource(extract, source, hasImage)) {
      return groundedFallback(input.text);
    }
    return extract;
  } catch (err) {
    console.error("AI extract failed, fallback mock", err);
    const mock = mockExtract(input.text, input.filename, analysisMode);
    return extractDriftsFromSource(mock, source, hasImage) ? groundedFallback(input.text) : mock;
  }
}

export type MeetingActionItem = {
  title: string;
  assigneeName: string | null;
  dueAt: string | null;
  notes: string | null;
};

export type MeetingExtractResult = {
  title: string;
  meetingAt: string | null;
  actions: MeetingActionItem[];
  mock: boolean;
  model?: string;
};

export type MinutesOutputLang = "original" | "zh" | "en";

export function normalizeMinutesOutputLang(v: unknown): MinutesOutputLang {
  const s = String(v || "").trim().toLowerCase();
  if (s === "zh" || s === "zh-hant" || s === "zh-tw" || s === "chinese" || s === "中文") {
    return "zh";
  }
  if (s === "en" || s === "english" || s === "eng") return "en";
  return "original";
}

function meetingLangRule(lang: MinutesOutputLang) {
  if (lang === "zh") {
    return "Output language: Traditional Chinese (繁體中文) for title, action titles, and notes. Keep assigneeName exactly as written in the source (do not translate names).";
  }
  if (lang === "en") {
    return "Output language: English for title, action titles, and notes. Keep assigneeName exactly as written in the source (do not translate names).";
  }
  return "Output language: keep the SAME language as the source minutes for title, action titles, and notes. Do NOT translate. Keep assigneeName exactly as written.";
}

function defaultMeetingTitle(lang: MinutesOutputLang) {
  if (lang === "en") return "Meeting action items";
  return "會議行動項目";
}

function mockMeetingExtract(
  text: string,
  lang: MinutesOutputLang = "original",
): MeetingExtractResult {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 4);
  const actionLines = lines.filter((l) =>
    /行動|跟進|負責|deadline|action|due|須|應|完成|安排/i.test(l),
  );
  const pick = (actionLines.length > 0 ? actionLines : lines).slice(0, 8);
  return {
    title: defaultMeetingTitle(lang),
    meetingAt: null,
    actions: pick.map((line) => ({
      title: line.slice(0, 120),
      assigneeName: null,
      dueAt: null,
      notes: null,
    })),
    mock: true,
  };
}

function normalizeMeetingDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export async function extractMeetingActions(
  text: string,
  opts?: { outputLang?: MinutesOutputLang },
): Promise<MeetingExtractResult> {
  const outputLang = normalizeMinutesOutputLang(opts?.outputLang);
  const body = text.trim();
  if (!body) {
    return { title: defaultMeetingTitle(outputLang), meetingAt: null, actions: [], mock: true };
  }
  if (!hasAIKey()) return mockMeetingExtract(body, outputLang);

  const model = getAIModel();
  try {
    const client = getAIClient();
    const langRule = meetingLangRule(outputLang);
    const res = await client.chat.completions.create({
      model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `You are a Hong Kong construction project meeting-minutes assistant. Return pure JSON only. Extract clear action items (who does what, by when) from text only. Ignore drawings, sketches, figures, Drawing/Figure/Sketch; do not create tasks for "see drawing" / "as shown". ${langRule}`,
        },
        {
          role: "user",
          content: `Extract action items from the meeting minutes text below. Return JSON only:
{
  "title": "short meeting title",
  "meetingAt": "YYYY-MM-DD or null",
  "actions": [
    {
      "title": "concise action",
      "assigneeName": "person name from source or null",
      "dueAt": "YYYY-MM-DD or null",
      "notes": "extra note or null"
    }
  ]
}
Rules:
- Text only; ignore drawings / figures / Drawing / DWG / Figure
- Only follow-up actions; skip pure info or already-done items
- Do not turn "see drawing" into a task
- assigneeName must match names as written in the source; null if none
- dueAt only when an explicit date exists
- Max 30 items
- ${langRule}

Meeting minutes text:
${body.slice(0, 18000)}`,
        },
      ],
    });
    const raw = res.choices[0]?.message?.content || "";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no json");
    const parsed = JSON.parse(match[0]) as {
      title?: string;
      meetingAt?: string | null;
      actions?: Array<{
        title?: string;
        assigneeName?: string | null;
        dueAt?: string | null;
        notes?: string | null;
      }>;
    };
    const fallbackTitle = defaultMeetingTitle(outputLang);
    const actions = (Array.isArray(parsed.actions) ? parsed.actions : [])
      .map((a) => ({
        title: String(a.title || "").trim(),
        assigneeName: a.assigneeName ? String(a.assigneeName).trim() : null,
        dueAt: normalizeMeetingDate(a.dueAt),
        notes: a.notes ? String(a.notes).trim() : null,
      }))
      .filter((a) => a.title.length > 0)
      .slice(0, 30);

    return {
      title: String(parsed.title || fallbackTitle).trim() || fallbackTitle,
      meetingAt: normalizeMeetingDate(parsed.meetingAt),
      actions,
      mock: false,
      model,
    };
  } catch (err) {
    console.error("extractMeetingActions failed", err);
    return mockMeetingExtract(body, outputLang);
  }
}

export type ChatTextOptions = {
  temperature?: number;
  maxTokens?: number;
  system?: string;
};

export async function chatText(
  prompt: string,
  options?: ChatTextOptions,
): Promise<string | null> {
  if (!hasAIKey()) return null;
  const client = getAIClient();
  const model = getAIModel();
  const system =
    options?.system ||
    "你是香港工地與土木工程顧問。使用繁體中文。回答簡潔正確；法規須有依據，不可捏造條號頁碼。";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await client.chat.completions.create({
        model,
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens ?? 700,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      });
      const text = res.choices[0]?.message?.content?.trim() || null;
      if (text) return text;
    } catch (err) {
      console.error(`AI chatText failed (attempt ${attempt})`, err);
      if (attempt < 2) await new Promise((r) => setTimeout(r, 600));
    }
  }
  return null;
}

export async function transcribeAudio(buffer: Buffer, filename: string) {
  const apiKey = process.env.CANTONESE_AI_API_KEY?.trim();
  if (!apiKey) {
    return {
      text: `（語音轉寫提示）${filename}：請設定 CANTONESE_AI_API_KEY，或改用文字說明。`,
      mock: true,
    };
  }

  try {
    const form = new FormData();
    form.set("api_key", apiKey);
    form.set("wait_for_completion", "true");
    form.set("skip_fusion", "false");
    form.set("context", "香港地盤安全、質量、進度、圍欄、鋼筋、混凝土、分判商");
    const bytes = new Uint8Array(buffer);
    const mime = filename.match(/\.ogg$/i)
      ? "audio/ogg"
      : filename.match(/\.mp3$/i)
        ? "audio/mpeg"
        : filename.match(/\.m4a$/i)
          ? "audio/mp4"
          : filename.match(/\.wav$/i)
            ? "audio/wav"
            : "audio/ogg";
    form.set("data", new File([bytes], filename || "voice.ogg", { type: mime }));

    const res = await fetch("https://cantonese.ai/api/stt", {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[cantonese.ai] STT failed", res.status, errText.slice(0, 200));
      return {
        text: `（語音轉寫失敗）${filename}`,
        mock: true,
      };
    }
    const data = (await res.json()) as {
      text?: string;
      transcription?: string;
      fused_transcription?: string;
    };
    const text =
      data.fused_transcription || data.transcription || data.text || "";
    if (!text.trim()) {
      return { text: `（語音轉寫空白）${filename}`, mock: true };
    }
    return { text: text.trim(), mock: false };
  } catch (err) {
    console.error("[cantonese.ai] STT error", err);
    return {
      text: `（語音轉寫失敗）${filename}`,
      mock: true,
    };
  }
}
