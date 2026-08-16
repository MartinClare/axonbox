import React, { type ReactElement } from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { DailyReportPayload, EventReportPayload } from "./types";
import { CATEGORY_LABELS, CASE_STATUS_LABELS, SEVERITY_LABELS } from "@/lib/labels";
import { ensurePdfFonts, PDF_FONT_FAMILY } from "@/lib/reports/pdf-fonts";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, color: "#0f172a", fontFamily: PDF_FONT_FAMILY },
  h1: { fontSize: 18, marginBottom: 6, color: "#0c2340", fontFamily: PDF_FONT_FAMILY, fontWeight: 700 },
  h2: { fontSize: 12, marginTop: 14, marginBottom: 6, color: "#163a5f", fontFamily: PDF_FONT_FAMILY, fontWeight: 700 },
  meta: { color: "#64748b", marginBottom: 4 },
  boxRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  box: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    marginBottom: 4,
  },
  table: { marginTop: 4 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  th: { flex: 1, fontSize: 9, fontFamily: PDF_FONT_FAMILY, fontWeight: 700, paddingVertical: 4, paddingRight: 4 },
  td: { flex: 1, fontSize: 9, paddingVertical: 4, paddingRight: 4 },
  p: { lineHeight: 1.45, marginBottom: 4 },
  foot: { marginTop: 18, fontSize: 8, color: "#94a3b8" },
});

function DailyDoc({ payload }: { payload: DailyReportPayload }) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.h1 }, payload.title),
      React.createElement(
        Text,
        { style: styles.meta },
        `${payload.projectName} · ${payload.siteCode} · ${payload.date} · 天氣 ${payload.weather}`,
      ),
      React.createElement(Text, { style: styles.meta }, `報告人：${payload.reporterName}`),
      React.createElement(Text, { style: styles.h2 }, "現場綜述"),
      React.createElement(Text, { style: styles.p }, payload.narrative || "—"),
      React.createElement(Text, { style: styles.h2 }, "人員與資源"),
      React.createElement(
        View,
        { style: styles.boxRow },
        ...[
          `工人 ${payload.workerCount}`,
          `分判 ${payload.subcontractorCount}`,
          `设备 ${payload.equipmentCount}`,
          `进度 ${payload.progressPct}%`,
          `安全 ${payload.safetyEvents}`,
        ].map((t, i) =>
          React.createElement(View, { key: i, style: styles.box }, React.createElement(Text, null, t)),
        ),
      ),
      React.createElement(Text, { style: styles.h2 }, "主要活动"),
      React.createElement(
        View,
        { style: styles.table },
        React.createElement(
          View,
          { style: styles.tr },
          React.createElement(Text, { style: styles.th }, "时间"),
          React.createElement(Text, { style: styles.th }, "内容"),
          React.createElement(Text, { style: styles.th }, "状态"),
        ),
        ...payload.activities.map((a, i) =>
          React.createElement(
            View,
            { key: i, style: styles.tr },
            React.createElement(Text, { style: styles.td }, a.time),
            React.createElement(Text, { style: styles.td }, a.name),
            React.createElement(Text, { style: styles.td }, a.status),
          ),
        ),
      ),
      React.createElement(Text, { style: styles.h2 }, "問題與跟進"),
      React.createElement(
        View,
        { style: styles.table },
        React.createElement(
          View,
          { style: styles.tr },
          React.createElement(Text, { style: styles.th }, "编号"),
          React.createElement(Text, { style: styles.th }, "问题"),
          React.createElement(Text, { style: styles.th }, "风险"),
          React.createElement(Text, { style: styles.th }, "负责人"),
        ),
        ...payload.issues.map((iss, i) =>
          React.createElement(
            View,
            { key: i, style: styles.tr },
            React.createElement(Text, { style: styles.td }, iss.id),
            React.createElement(Text, { style: styles.td }, iss.issue),
            React.createElement(Text, { style: styles.td }, SEVERITY_LABELS[iss.risk] || iss.risk),
            React.createElement(Text, { style: styles.td }, iss.assignee),
          ),
        ),
      ),
      React.createElement(Text, { style: styles.h2 }, "明日计划"),
      ...payload.plans.map((p, i) =>
        React.createElement(Text, { key: i, style: styles.p }, `• ${p}`),
      ),
      React.createElement(Text, { style: styles.foot }, "由 AXON Case 自動彙整 · 證據可追溯"),
    ),
  );
}

function EventDoc({ payload }: { payload: EventReportPayload }) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.h1 }, payload.title),
      React.createElement(
        Text,
        { style: styles.meta },
        `${payload.projectName} · ${payload.siteCode} · ${payload.generatedAt}`,
      ),
      payload.summary
        ? React.createElement(Text, { style: styles.p }, payload.summary)
        : null,
      React.createElement(Text, { style: styles.h2 }, "事件清单"),
      React.createElement(
        View,
        { style: styles.table },
        React.createElement(
          View,
          { style: styles.tr },
          React.createElement(Text, { style: styles.th }, "编号"),
          React.createElement(Text, { style: styles.th }, "标题"),
          React.createElement(Text, { style: styles.th }, "分类"),
          React.createElement(Text, { style: styles.th }, "状态"),
        ),
        ...payload.rows.map((r, i) =>
          React.createElement(
            View,
            { key: i, style: styles.tr },
            React.createElement(Text, { style: styles.td }, r.caseNo),
            React.createElement(Text, { style: styles.td }, r.title),
            React.createElement(
              Text,
              { style: styles.td },
              CATEGORY_LABELS[r.category] || r.category,
            ),
            React.createElement(
              Text,
              { style: styles.td },
              CASE_STATUS_LABELS[r.status] || r.status,
            ),
          ),
        ),
      ),
      React.createElement(
        Text,
        { style: styles.foot },
        `共 ${payload.rows.length} 則 · AXON Case`,
      ),
    ),
  );
}

export async function buildDailyPdf(payload: DailyReportPayload): Promise<Buffer> {
  ensurePdfFonts();
  const element = React.createElement(DailyDoc, {
    payload,
  }) as unknown as ReactElement<DocumentProps>;
  const buf = await renderToBuffer(element);
  return Buffer.from(buf);
}

export async function buildEventPdf(payload: EventReportPayload): Promise<Buffer> {
  ensurePdfFonts();
  const element = React.createElement(EventDoc, {
    payload,
  }) as unknown as ReactElement<DocumentProps>;
  const buf = await renderToBuffer(element);
  return Buffer.from(buf);
}
