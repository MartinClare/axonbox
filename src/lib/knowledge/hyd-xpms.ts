/**
 * Hong Kong Highways Department (HyD) / XPMS knowledge snippets
 * for citation-backed engineering answers.
 *
 * Sources (public):
 * - https://www.hyd.gov.hk
 * - https://xpms.hyd.gov.hk (works partners platform)
 * - Excavation Permit Processing Manual (XPPM) consolidated PDF
 *   https://www.hyd.gov.hk/en/technical_references/technical_document/xppm/manual/doc/consolidated_version.pdf
 *
 * page = approximate page in the consolidated XPPM PDF (as published online).
 */

export type KnowledgeDoc = {
  id: string;
  title: string;
  content: string;
  source: string;
  sourceUrl: string;
  page: number | string;
  section?: string;
  tags: string[];
};

export const HYD_XPMS_DOCS: KnowledgeDoc[] = [
  {
    id: "hyd-legal-basis",
    title: "挖掘許可的法律依據",
    content:
      "根據《土地（雜項條文）條例》，路政署署長負責管制由路政署維修的街道上之挖掘工程；地政總署署長則負責管制未批租土地上之挖掘。Excavation Permit（XP）是路政署對公共道路挖掘的主要管制工具。",
    source: "Excavation Permit Processing Manual (XPPM)",
    sourceUrl:
      "https://www.hyd.gov.hk/en/technical_references/technical_document/xppm/manual/doc/consolidated_version.pdf",
    page: 1,
    section: "Introduction",
    tags: ["法律", "條例", "XP", "許可證", "Land Ordinance"],
  },
  {
    id: "xpms-overview",
    title: "XPMS 系統簡介",
    content:
      "Excavation Permit Management System（XPMS）是路政署的網上平台，供公用事業機構（UU）、承建商及政府部門（HyD、TD、HKPF、LCSD 等）處理道路挖掘及相關許可申請，包括一般 XP、緊急 XP、高速公路工程許可及道路工程許可。系統於 2009 年 8 月由早期 UMS 升級而成。",
    source: "Highways Department – Excavation Management",
    sourceUrl: "https://www.hyd.gov.hk/en/information_corner/rnd/excavation_management/",
    page: "網上頁（Excavation Management）",
    section: "Introduction of XPMS",
    tags: ["XPMS", "系統", "申請", "許可", "緊急"],
  },
  {
    id: "xpms-four-phases",
    title: "XP 申請四大階段",
    content:
      "在 XPMS 中，整個 XP 申請流程分為四個主要階段：Registration（登記）、Assessment（評估）、Permit Processing（許可處理）及 Works Management（工程管理）。用戶可於工作台收件箱接收系統按流程自動分派的任務，並透過 process trail 追蹤進度。",
    source: "Excavation Permit Processing Manual (XPPM)",
    sourceUrl:
      "https://www.hyd.gov.hk/en/technical_references/technical_document/xppm/manual/doc/consolidated_version.pdf",
    page: "約 Ch.3 §3.7",
    section: "Chapter 3 – XPMS",
    tags: ["流程", "登記", "評估", "工程管理", "workflow"],
  },
  {
    id: "xpms-user-registration",
    title: "XPMS 用戶登記（私人公司）",
    content:
      "私人公司（如公用事業機構、建築公司）須以書面方式向路政署首席工程師／研究及發展（CHE/R&D）申請登記為 XPMS User，並提交有效商業登記證副本，以及最多兩名職員作為用戶管理員提名。政府部門程序略有不同。",
    source: "Excavation Permit Processing Manual (XPPM)",
    sourceUrl:
      "https://www.hyd.gov.hk/en/technical_references/technical_document/xppm/manual/doc/consolidated_version.pdf",
    page: "Ch.4 §2.0–2.1",
    section: "XPMS User Registration",
    tags: ["登記", "用戶", "商業登記", "管理員", "註冊"],
  },
  {
    id: "plan-registration",
    title: "工程計劃（Plan）登記要求",
    content:
      "申請人（UU 或政府部門）須先在 XPMS 建立 plan 以登記擬議挖掘工程。每個 plan 可申請一張 XP；一個 plan 可包含多個 excavation item。每個 item 對應路政署維修範圍內的行車道、行人路、後巷／側巷、路肩、單車徑或路旁斜坡上之挖掘。完成登記需填寫位置與擬開始日期等必填資料、以點／線／面數碼化挖掘範圍，並提供工程進度表（Gantt）。",
    source: "XPPM Chapter 4 / CH4_S1",
    sourceUrl:
      "https://www.hyd.gov.hk/en/technical_references/technical_document/xppm/manual/doc/CH4_S1_V22.pdf",
    page: "§2.0–2.3",
    section: "Registration",
    tags: ["plan", "登記", "GIS", "進度表", "Gantt", "item"],
  },
  {
    id: "advance-notification",
    title: "開工前預先知會（Advance Notification）",
    content:
      "申請人須在預計開工前 2 個工作天，透過 XPMS 向 HyD／HKPF／TD 等提交 Advance Notification（AN）。若其後須延期開工，必須立即在 XPMS 取消該 AN，並於確定新開工日期後重新提交。沒有 XPMS 帳戶者應使用 HYD 91 表格以傳真通知相關部門。",
    source: "Excavation Permit Processing Manual (XPPM)",
    sourceUrl:
      "https://www.hyd.gov.hk/en/technical_references/technical_document/xppm/manual/doc/consolidated_version.pdf",
    page: "流程圖／AN 相關章節（約 Ch.2）",
    section: "Advance Notification",
    tags: ["AN", "預告", "開工", "HYD 91", "通知"],
  },
  {
    id: "short-standard-works",
    title: "工程類別：短期／標準／非標準",
    content:
      "非緊急工程可分為：短期工程（Short duration works）工期不超過 14 個工作天；標準工程（Standard works）工期按標準工序範本計算；非標準工程（Non-standard works）須以理據支持工期，並在 XPMS 製作 Gantt，或修改標準範本，亦可匯入 MS Project 兼容檔。",
    source: "XPPM Chapter 4 / CH4_S1",
    sourceUrl:
      "https://www.hyd.gov.hk/en/technical_references/technical_document/xppm/manual/doc/CH4_S1_V22.pdf",
    page: "§3.0 附近",
    section: "Works programme",
    tags: ["工期", "短期", "標準", "非標準", "14天"],
  },
  {
    id: "xpms-support",
    title: "XPMS 技術支援",
    content:
      "有關 XPMS 使用查詢，可聯絡路政署 XPMS Support Team：電話 2762 3357；電郵 xpmssupport.rnd@hyd.gov.hk。路政署 24 小時熱線：2926 4111。官方入口：xpms.hyd.gov.hk；部門網站：www.hyd.gov.hk。",
    source: "Highways Department – Excavation Management",
    sourceUrl: "https://www.hyd.gov.hk/en/information_corner/rnd/excavation_management/",
    page: "網上頁（Support）",
    section: "Enquiries",
    tags: ["支援", "電話", "電郵", "熱線", "聯絡"],
  },
  {
    id: "coordination",
    title: "道路工程協調",
    content:
      "為有效協調道路工程，系統設有最短登記提前時間（lead-time）。登記後 HyD 會評估是否需要協調；申請人可下載每週產生的衝突工程報告（conflicting works report），主導申請人須將議定工程進度表呈交 HyD 批准。申請人亦可按 UTLC paper 1/98 以書面申請豁免 lead-time（須提出理據）。",
    source: "Excavation Permit Processing Manual (XPPM)",
    sourceUrl:
      "https://www.hyd.gov.hk/en/technical_references/technical_document/xppm/manual/doc/consolidated_version.pdf",
    page: "約 Ch.2 協調／lead-time 表",
    section: "Coordination",
    tags: ["協調", "衝突", "lead-time", "UTLC"],
  },
];

export function searchKnowledge(query: string, limit = 6): KnowledgeDoc[] {
  const q = query.toLowerCase();
  const tokens = q.split(/[\s,，。？?、；;]+/).filter((t) => t.length > 1);
  const scored = HYD_XPMS_DOCS.map((doc) => {
    const hay = `${doc.title} ${doc.content} ${doc.tags.join(" ")}`.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (hay.includes(t)) score += 2;
      if (doc.tags.some((tag) => tag.toLowerCase().includes(t))) score += 3;
    }
    if (hay.includes(q)) score += 5;
    return { doc, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((x) => x.doc);
}

export function formatCitation(doc: KnowledgeDoc) {
  return `《${doc.source}》p.${doc.page}${doc.section ? `（${doc.section}）` : ""}`;
}

export function knowledgeContextForPrompt(docs: KnowledgeDoc[]) {
  if (!docs.length) return "（無匹配官方條文，請說明需人工核對 XPMS／XPPM 原文）";
  return docs
    .map(
      (d, i) =>
        `[${i + 1}] ${d.title}\n內容：${d.content}\n出處：${formatCitation(d)}\nURL：${d.sourceUrl}`,
    )
    .join("\n\n");
}
