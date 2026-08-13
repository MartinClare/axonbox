import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import type { DailyReportPayload, EventReportPayload } from "./types";
import { CATEGORY_LABELS, CASE_STATUS_LABELS, SEVERITY_LABELS } from "@/lib/labels";

const border = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
};

function cell(text: string, bold = false) {
  return new TableCell({
    borders: border,
    width: { size: 1800, type: WidthType.DXA },
    children: [
      new Paragraph({
        children: [new TextRun({ text: text || "—", bold, size: 18 })],
      }),
    ],
  });
}

export async function buildDailyDocx(payload: DailyReportPayload): Promise<Buffer> {
  const rows = [
    new TableRow({
      children: ["时间", "内容", "状态"].map((h) => cell(h, true)),
    }),
    ...payload.activities.map(
      (a) =>
        new TableRow({
          children: [cell(a.time), cell(a.name), cell(a.status)],
        }),
    ),
  ];

  const issueRows = [
    new TableRow({
      children: ["編號", "問題", "風險", "負責人", "狀態"].map((h) => cell(h, true)),
    }),
    ...payload.issues.map(
      (i) =>
        new TableRow({
          children: [
            cell(i.id),
            cell(i.issue),
            cell(SEVERITY_LABELS[i.risk] || i.risk),
            cell(i.assignee),
            cell(CASE_STATUS_LABELS[i.status] || i.status),
          ],
        }),
    ),
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: payload.title,
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${payload.projectName} · ${payload.siteCode} · ${payload.date} · 天气 ${payload.weather}`,
                size: 20,
                color: "64748B",
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `報告人：${payload.reporterName}`,
                size: 20,
                color: "64748B",
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "現場綜述", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({
            children: [new TextRun({ text: payload.narrative || "—", size: 22 })],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "人員與資源", heading: HeadingLevel.HEADING_2 }),
          new Paragraph({
            text: `工人 ${payload.workerCount} · 分判 ${payload.subcontractorCount} · 设备 ${payload.equipmentCount} · 材料送达 ${payload.materialDeliveries} · 进度 ${payload.progressPct}% · 安全事项 ${payload.safetyEvents}`,
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "主要活动", heading: HeadingLevel.HEADING_2 }),
          new Table({ width: { size: 9000, type: WidthType.DXA }, rows }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "問題與跟進", heading: HeadingLevel.HEADING_2 }),
          new Table({ width: { size: 9000, type: WidthType.DXA }, rows: issueRows }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "明日计划", heading: HeadingLevel.HEADING_2 }),
          ...payload.plans.map((p) => new Paragraph({ text: `• ${p}` })),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun({
                text: "由 AXON Case 自動彙整 · 證據可追溯",
                size: 16,
                color: "94A3B8",
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export async function buildEventDocx(payload: EventReportPayload): Promise<Buffer> {
  const header = new TableRow({
    children: ["编号", "标题", "分类", "风险", "位置", "状态", "分判", "负责人"].map((h) =>
      cell(h, true),
    ),
  });
  const rows = [
    header,
    ...payload.rows.map(
      (r) =>
        new TableRow({
          children: [
            cell(r.caseNo),
            cell(r.title),
            cell(CATEGORY_LABELS[r.category] || r.category),
            cell(SEVERITY_LABELS[r.severity] || r.severity),
            cell(r.location),
            cell(CASE_STATUS_LABELS[r.status] || r.status),
            cell(r.subcontractor),
            cell(r.assignee),
          ],
        }),
    ),
  ];

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: payload.title, heading: HeadingLevel.HEADING_1 }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${payload.projectName} · ${payload.siteCode} · 生成于 ${payload.generatedAt}`,
                size: 20,
                color: "64748B",
              }),
            ],
          }),
          new Paragraph({ text: "" }),
          ...(payload.summary
            ? [
                new Paragraph({ text: "摘要", heading: HeadingLevel.HEADING_2 }),
                new Paragraph({ text: payload.summary }),
                new Paragraph({ text: "" }),
              ]
            : []),
          new Paragraph({ text: "事件清单", heading: HeadingLevel.HEADING_2 }),
          new Table({ width: { size: 9000, type: WidthType.DXA }, rows }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [
              new TextRun({
                text: `共 ${payload.rows.length} 条 · AXON Case`,
                size: 16,
                color: "94A3B8",
              }),
            ],
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
