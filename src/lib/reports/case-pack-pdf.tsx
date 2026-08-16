import React, { type ReactElement } from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  renderToBuffer,
  type DocumentProps,
} from "@react-pdf/renderer";
import {
  CATEGORY_LABELS,
  CASE_STATUS_LABELS,
  SEVERITY_LABELS,
} from "@/lib/labels";

export type CasePackPayload = {
  caseNo: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  location: string;
  status: string;
  projectName: string;
  siteCode: string;
  assignee: string;
  subcontractor: string;
  discoveredAt: string;
  dueAt: string;
  closedAt: string;
  recommendation: string;
  events: Array<{ at: string; type: string; note: string; actor: string }>;
  beforeImages: Array<{ title: string; dataUrl?: string }>;
  afterImages: Array<{ title: string; dataUrl?: string }>;
  generatedAt: string;
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: "#0f172a", fontFamily: "Helvetica" },
  h1: { fontSize: 16, marginBottom: 6, color: "#0c2340" },
  h2: { fontSize: 12, marginTop: 14, marginBottom: 6, color: "#163a5f" },
  meta: { color: "#64748b", marginBottom: 3 },
  p: { lineHeight: 1.45, marginBottom: 4 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 80, color: "#64748b" },
  value: { flex: 1 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 3 },
  td: { flex: 1, fontSize: 9, paddingRight: 4 },
  imgWrap: { marginBottom: 8 },
  img: { width: 240, height: 160, objectFit: "cover", marginBottom: 2 },
  foot: { marginTop: 16, fontSize: 8, color: "#94a3b8" },
});

function CasePackDoc({ payload }: { payload: CasePackPayload }) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.h1 }, `結案摘要 · ${payload.caseNo}`),
      React.createElement(Text, { style: styles.meta }, payload.title),
      React.createElement(
        Text,
        { style: styles.meta },
        `${payload.projectName} · ${payload.siteCode} · ${payload.generatedAt}`,
      ),
      React.createElement(
        View,
        null,
        ...[
          ["狀態", CASE_STATUS_LABELS[payload.status] || payload.status],
          ["分類", CATEGORY_LABELS[payload.category] || payload.category],
          ["嚴重度", SEVERITY_LABELS[payload.severity] || payload.severity],
          ["位置", payload.location],
          ["負責人", payload.assignee],
          ["分判", payload.subcontractor],
          ["發現", payload.discoveredAt],
          ["期限", payload.dueAt],
          ["關閉", payload.closedAt],
        ].map(([k, v], i) =>
          React.createElement(
            View,
            { key: i, style: styles.row },
            React.createElement(Text, { style: styles.label }, k),
            React.createElement(Text, { style: styles.value }, v || "—"),
          ),
        ),
      ),
      React.createElement(Text, { style: styles.h2 }, "說明"),
      React.createElement(Text, { style: styles.p }, payload.description || "—"),
      payload.recommendation
        ? React.createElement(
            View,
            null,
            React.createElement(Text, { style: styles.h2 }, "整改指示"),
            React.createElement(Text, { style: styles.p }, payload.recommendation),
          )
        : null,
      React.createElement(Text, { style: styles.h2 }, "時間線"),
      ...payload.events.map((e, i) =>
        React.createElement(
          View,
          { key: i, style: styles.tr },
          React.createElement(Text, { style: styles.td }, e.at),
          React.createElement(Text, { style: styles.td }, e.type),
          React.createElement(Text, { style: styles.td }, e.note || "—"),
          React.createElement(Text, { style: styles.td }, e.actor || "—"),
        ),
      ),
      React.createElement(Text, { style: styles.h2 }, "整改前"),
      ...(payload.beforeImages.length
        ? payload.beforeImages.map((img, i) =>
            React.createElement(
              View,
              { key: `b${i}`, style: styles.imgWrap },
              img.dataUrl
                ? React.createElement(Image, { style: styles.img, src: img.dataUrl })
                : null,
              React.createElement(Text, { style: styles.meta }, img.title),
            ),
          )
        : [React.createElement(Text, { key: "bn", style: styles.p }, "（無）")]),
      React.createElement(Text, { style: styles.h2 }, "整改後"),
      ...(payload.afterImages.length
        ? payload.afterImages.map((img, i) =>
            React.createElement(
              View,
              { key: `a${i}`, style: styles.imgWrap },
              img.dataUrl
                ? React.createElement(Image, { style: styles.img, src: img.dataUrl })
                : null,
              React.createElement(Text, { style: styles.meta }, img.title),
            ),
          )
        : [React.createElement(Text, { key: "an", style: styles.p }, "（無／已無圖關閉）")]),
      React.createElement(Text, { style: styles.foot }, "AXON Case 結案摘要 · 私人項目監督紀錄"),
    ),
  );
}

export async function buildCasePackPdf(payload: CasePackPayload): Promise<Buffer> {
  const element = React.createElement(CasePackDoc, {
    payload,
  }) as unknown as ReactElement<DocumentProps>;
  const buf = await renderToBuffer(element);
  return Buffer.from(buf);
}
