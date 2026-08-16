import type OpenAI from "openai";
import { getAIClient, getAIModel, hasAIKey, hasOpenAIKey } from "./ai-client";

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
};

export { hasAIKey, hasOpenAIKey, getAIModel };

const CATEGORIES: CaseCategory[] = [
  "SAFETY",
  "QUALITY",
  "PROGRESS",
  "ENVIRONMENT",
  "OTHER",
];

function mockExtract(text?: string, filename?: string): ExtractResult {
  const blob = `${text || ""} ${filename || ""}`.toLowerCase();
  let category: CaseCategory = "OTHER";
  let severity: Severity = "MEDIUM";
  let title = "現場狀況需跟進";
  let location = "地盤區域待確認";
  let recommendation = "請現場主管核查並安排整改";
  let progressPct = 55;
  let workActivity = "模板／鋼筋作業";
  let findings: SiteFinding[] = [];
  let siteSummary = "已識別現場照片，建議人工確認關鍵細節";

  if (/安全|safety|圍欄|护栏|護欄|helmet|防護|防护|高空|洞口|opening|fence/.test(blob)) {
    category = "SAFETY";
    severity = "HIGH";
    title = "安全漏洞：邊緣防護不足";
    recommendation = "立即補設安全圍欄／洞口封閉，限制人員進入，並通知分判商整改";
    location = "B區 - 5樓平台";
    progressPct = 62;
    workActivity = "模板作業";
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
  };
}

function parseJsonLoose(raw: string): Partial<ExtractResult> & {
  findings?: SiteFinding[];
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
  parsed: Partial<ExtractResult> & { findings?: SiteFinding[] },
  input: { text?: string },
  model: string,
): ExtractResult {
  const category = CATEGORIES.includes(parsed.category as CaseCategory)
    ? (parsed.category as CaseCategory)
    : "OTHER";
  const severity =
    parsed.severity === "HIGH" ||
    parsed.severity === "MEDIUM" ||
    parsed.severity === "LOW"
      ? parsed.severity
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

  return {
    title: parsed.title || "現場分析",
    description: parsed.description || input.text || "AI 已完成場地分析",
    category,
    severity,
    location: parsed.location || "地盤區域待確認",
    recommendation: parsed.recommendation || "請安排跟進",
    suggestedAssigneeRole: parsed.suggestedAssigneeRole || "SUPERVISOR",
    progressPct: Math.min(100, Math.max(0, Number(parsed.progressPct) || 50)),
    workActivity: parsed.workActivity || "現場作業",
    findings,
    siteSummary: parsed.siteSummary || parsed.description || "",
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.7)),
    mock: false,
    model,
  };
}

export async function extractFromInput(input: {
  text?: string;
  imageBase64?: string;
  imageMime?: string;
  filename?: string;
  mode?: "site" | "email";
  documentNote?: string;
}): Promise<ExtractResult> {
  if (!hasAIKey()) {
    return mockExtract(input.text, input.filename);
  }

  const model = getAIModel();
  const emailRules =
    input.mode === "email"
      ? `
這是一封轉寄到 AxonBox 的郵件。必須以郵件主旨與正文判斷個案。
- 不要把 PDF／Word 全文、條款或工作清單寫進 description 或 recommendation。
- 若有「附件摘錄」，只用來確認這是什麼個案（標題、類別、地點、嚴重度）。最多在 description 加一句「附件為…」。
- 不要執行或展開附件裡提到的所有事項。
`
      : "";
  const docNote = input.documentNote
    ? `\n附件摘錄（僅供判斷主題，勿寫進個案正文）：\n${input.documentNote}\n`
    : "";
  try {
    const client = getAIClient();
    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      {
        type: "text",
        text: `你是 AxonBox 資深工地巡檢／香港工程顧問 AI（熟悉 HyD XPMS／道路挖掘許可常識）。
${emailRules}請分析現場照片／文字，找出安全漏洞、質量缺陷、進度線索，並在 recommendation 中提示是否可能涉及公共道路挖掘／XP／AN（Advance Notification）等合規動作（若無關則勿硬套）。
只回傳純 JSON，文字必須使用繁體中文：
{
  "title":"一句話標題",
  "description":"現場狀況摘要",
  "category":"SAFETY|QUALITY|PROGRESS|ENVIRONMENT|OTHER",
  "severity":"HIGH|MEDIUM|LOW",
  "location":"推測位置",
  "recommendation":"具體下一步（可含合規提示）",
  "suggestedAssigneeRole":"SUPERVISOR|SUBCONTRACTOR",
  "progressPct":0到100的整數,
  "workActivity":"主要工序",
  "siteSummary":"一句話場地判斷",
  "confidence":0到1,
  "findings":[{"type":"SAFETY_GAP|QUALITY_DEFECT|PROGRESS|ENVIRONMENT|OTHER","label":"短標籤","detail":"具體說明","severity":"HIGH|MEDIUM|LOW"}]
}
重點檢查：圍欄／防護、洞口未封、高空／PPE、鋼筋外露、裂縫、材料堆放、通道阻礙、明顯進度階段、臨時交通／圍板跡象。
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
      temperature: 0.2,
    });
    const raw = res.choices[0]?.message?.content || "";
    const parsed = parseJsonLoose(raw);
    if (!parsed.title && !parsed.description && !parsed.findings?.length) {
      throw new Error(`Empty AI response: ${raw.slice(0, 200)}`);
    }
    return normalizeExtract(parsed, input, model);
  } catch (err) {
    console.error("AI extract failed, fallback mock", err);
    return mockExtract(input.text, input.filename);
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

function mockMeetingExtract(text: string): MeetingExtractResult {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 4);
  const actionLines = lines.filter((l) =>
    /行動|跟進|負責|deadline|action|due|須|應|完成|安排/i.test(l),
  );
  const pick = (actionLines.length > 0 ? actionLines : lines).slice(0, 8);
  return {
    title: "會議行動項目",
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

export async function extractMeetingActions(text: string): Promise<MeetingExtractResult> {
  const body = text.trim();
  if (!body) {
    return { title: "會議行動項目", meetingAt: null, actions: [], mock: true };
  }
  if (!hasAIKey()) return mockMeetingExtract(body);

  const model = getAIModel();
  try {
    const client = getAIClient();
    const res = await client.chat.completions.create({
      model,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content:
            "你是香港工程項目會議紀錄助理。只回傳純 JSON，繁體中文。只抽出明確的行動項目（誰做什麼、何時），不要把討論紀錄整段變成任務。",
        },
        {
          role: "user",
          content: `請從以下會議紀錄抽出行動項目。只回傳 JSON：
{
  "title": "會議短標題",
  "meetingAt": "YYYY-MM-DD 或 null",
  "actions": [
    {
      "title": "要做的事（簡潔）",
      "assigneeName": "負責人姓名或 null",
      "dueAt": "YYYY-MM-DD 或 null",
      "notes": "補充說明或 null"
    }
  ]
}
規則：
- 只抽有跟進責任的事項；略過純資訊／已完成事項
- assigneeName 用紀錄裡出現的人名；沒有就 null
- dueAt 僅在有明確日期時填寫
- 最多 30 項

會議紀錄：
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
      title: String(parsed.title || "會議行動項目").trim() || "會議行動項目",
      meetingAt: normalizeMeetingDate(parsed.meetingAt),
      actions,
      mock: false,
      model,
    };
  } catch (err) {
    console.error("extractMeetingActions failed", err);
    return mockMeetingExtract(body);
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
  // OpenRouter VL path is primary; audio stays mock-friendly unless native Whisper is configured
  if (!process.env.OPENAI_API_KEY?.trim() || process.env.OPENROUTER_API_KEY) {
    return {
      text: `（語音轉寫提示）${filename}：請改用文字說明，或設定原生 Whisper 相容接口。`,
      mock: true,
    };
  }
  try {
    const client = getAIClient();
    const bytes = new Uint8Array(buffer);
    const file = new File([bytes], filename, { type: "audio/webm" });
    const result = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    return { text: result.text, mock: false };
  } catch (err) {
    console.error("Whisper failed", err);
    return {
      text: `（语音转写失败，改用 Mock）${filename}`,
      mock: true,
    };
  }
}
