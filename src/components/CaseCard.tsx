"use client";

import { CATEGORY_COLORS, STATUS_COLORS, cn } from "@/lib/labels";
import { mediaUrl } from "@/lib/media";
import { useI18n } from "@/components/I18nProvider";
import Link from "next/link";

type CaseItem = {
  id: string;
  caseNo: string;
  title: string;
  location: string;
  category: string;
  status: string;
  discoveredAt: string | Date;
  evidence?: { filePath: string | null }[];
};

function formatCaseDate(d: Date | string, locale: string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString(locale === "en" ? "en-HK" : "zh-HK", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CaseCard({ item }: { item: CaseItem }) {
  const { t, locale, categoryLabels, caseStatusLabels } = useI18n();
  const thumb = mediaUrl(item.evidence?.find((e) => e.filePath)?.filePath);
  return (
    <Link
      href={`/cases/${item.id}`}
      className="flex gap-3 rounded-[var(--radius-md)] border border-[var(--axon-line)] bg-[var(--axon-white)] p-3 transition hover:border-[var(--axon-accent)] hover:shadow-[0_6px_18px_rgba(247,127,0,0.1)]"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-[var(--axon-sand)] ring-1 ring-[var(--axon-line)]">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--axon-steel)]">
            {t("home.card.noImage")}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="truncate text-sm font-semibold text-[var(--axon-ink)]">{item.title}</div>
          <span className={cn("axon-chip shrink-0", STATUS_COLORS[item.status])}>
            {caseStatusLabels[item.status] || item.status}
          </span>
        </div>
        <div className="mt-1 text-xs text-[var(--axon-steel)]">{item.caseNo}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[var(--axon-steel)]">
          <span className={cn("axon-chip", CATEGORY_COLORS[item.category])}>
            {categoryLabels[item.category] || item.category}
          </span>
          <span>{item.location}</span>
          <span>{formatCaseDate(item.discoveredAt, locale)}</span>
        </div>
      </div>
    </Link>
  );
}
