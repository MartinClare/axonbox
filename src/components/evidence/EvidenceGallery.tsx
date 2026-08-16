"use client";

import { evidenceTags, isEvidenceImage, type EvidenceItem } from "./types";
import { CATEGORY_COLORS, STATUS_COLORS, cn, formatDate } from "@/lib/labels";
import { mediaUrl } from "@/lib/media";

type Props = {
  items: EvidenceItem[];
  selectedId?: string | null;
  evidenceStatusLabels: Record<string, string>;
  caseStatusLabels: Record<string, string>;
  categoryLabels: Record<string, string>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onOpen: (item: EvidenceItem) => void;
};

export function EvidenceGallery({
  items,
  selectedId,
  evidenceStatusLabels,
  caseStatusLabels,
  categoryLabels,
  t,
  onOpen,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-400">
        {t("evidence.empty")}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => {
        const url = mediaUrl(item.filePath);
        const showImg = url && isEvidenceImage(item);
        const tags = evidenceTags(item);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(item)}
            className={cn(
              "group relative aspect-square overflow-hidden rounded-xl border bg-slate-100 text-left transition",
              selectedId === item.id
                ? "border-[var(--axon-blue)] ring-2 ring-[var(--axon-blue)]/30"
                : "border-slate-200 hover:border-slate-300",
            )}
          >
            {showImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url!}
                alt=""
                className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
                <span className="rounded bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {item.type}
                </span>
                <span className="line-clamp-3 text-xs text-slate-600">{item.title}</span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-2 pb-2 pt-8">
              <div className="flex flex-wrap gap-1">
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px]",
                    STATUS_COLORS[item.status] || "bg-slate-700 text-white",
                  )}
                >
                  {evidenceStatusLabels[item.status] || item.status}
                </span>
                {item.case && (
                  <span className="rounded-full bg-[var(--axon-ink)]/85 px-1.5 py-0.5 text-[10px] text-white">
                    {item.case.caseNo}
                    <span className="opacity-80">
                      {" · "}
                      {caseStatusLabels[item.case.status] || item.case.status}
                    </span>
                  </span>
                )}
                {item.category && (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px]",
                      CATEGORY_COLORS[item.category] || "bg-white/80 text-slate-700",
                    )}
                  >
                    {categoryLabels[item.category] || item.category}
                  </span>
                )}
              </div>
              <div className="mt-1 truncate text-[11px] font-medium text-white drop-shadow">
                {item.title}
              </div>
              <div className="truncate text-[10px] text-white/75">{formatDate(item.capturedAt)}</div>
              {tags.length > 0 && (
                <div className="mt-0.5 truncate text-[10px] text-sky-100">
                  {tags
                    .slice(0, 2)
                    .map((tag) => `#${tag}`)
                    .join(" ")}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
