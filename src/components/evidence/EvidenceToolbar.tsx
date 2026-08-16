"use client";

import type { EvidenceFilters } from "./types";

type Props = {
  filters: EvidenceFilters;
  onChange: (next: EvidenceFilters) => void;
  onApply: () => void;
  categoryLabels: Record<string, string>;
  evidenceStatusLabels: Record<string, string>;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

export function EvidenceToolbar({
  filters,
  onChange,
  onApply,
  categoryLabels,
  evidenceStatusLabels,
  t,
}: Props) {
  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--axon-line)] bg-white p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onApply();
      }}
    >
      <label className="min-w-[10rem] flex-1 text-xs text-slate-500">
        {t("common.keyword")}
        <input
          className="axon-input mt-1 min-h-0 py-1.5 text-sm"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          placeholder={t("common.keyword")}
        />
      </label>
      <label className="text-xs text-slate-500">
        {t("common.category")}
        <select
          className="axon-input mt-1 min-h-0 py-1.5 text-sm"
          value={filters.category}
          onChange={(e) => onChange({ ...filters, category: e.target.value })}
        >
          <option value="">{t("evidence.filter.any")}</option>
          {Object.entries(categoryLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-500">
        {t("common.status")}
        <select
          className="axon-input mt-1 min-h-0 py-1.5 text-sm"
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value })}
        >
          <option value="">{t("evidence.filter.any")}</option>
          {Object.entries(evidenceStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-500">
        {t("evidence.filter.source")}
        <select
          className="axon-input mt-1 min-h-0 py-1.5 text-sm"
          value={filters.source}
          onChange={(e) => onChange({ ...filters, source: e.target.value })}
        >
          <option value="">{t("evidence.filter.any")}</option>
          <option value="UPLOAD">{t("evidence.src.upload")}</option>
          <option value="WHATSAPP_IMPORT">{t("evidence.src.wa")}</option>
          <option value="EMAIL_IMPORT">{t("evidence.src.email")}</option>
          <option value="FOLDER">{t("evidence.src.folder")}</option>
        </select>
      </label>
      <label className="text-xs text-slate-500">
        {t("evidence.filter.linked")}
        <select
          className="axon-input mt-1 min-h-0 py-1.5 text-sm"
          value={filters.linked}
          onChange={(e) =>
            onChange({ ...filters, linked: e.target.value as EvidenceFilters["linked"] })
          }
        >
          <option value="">{t("evidence.linked.all")}</option>
          <option value="1">{t("evidence.linked.yes")}</option>
          <option value="0">{t("evidence.linked.no")}</option>
        </select>
      </label>
      <label className="text-xs text-slate-500">
        {t("evidence.filter.sort")}
        <select
          className="axon-input mt-1 min-h-0 py-1.5 text-sm"
          value={`${filters.sort}:${filters.order}`}
          onChange={(e) => {
            const [sort, order] = e.target.value.split(":") as [
              EvidenceFilters["sort"],
              EvidenceFilters["order"],
            ];
            onChange({ ...filters, sort, order });
          }}
        >
          <option value="capturedAt:desc">{t("evidence.sort.newest")}</option>
          <option value="capturedAt:asc">{t("evidence.sort.oldest")}</option>
          <option value="createdAt:desc">{t("evidence.sort.addedNewest")}</option>
          <option value="createdAt:asc">{t("evidence.sort.addedOldest")}</option>
        </select>
      </label>
      <button type="submit" className="axon-btn axon-btn-primary px-4 py-2 text-sm">
        {t("common.filter")}
      </button>
    </form>
  );
}
