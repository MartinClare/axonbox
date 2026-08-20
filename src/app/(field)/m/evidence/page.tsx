"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { FilePreview } from "@/components/FilePreview";
import { mediaUrl } from "@/lib/media";
import { useI18n } from "@/components/I18nProvider";
import { isEvidenceImage, type EvidenceItem } from "@/components/evidence/types";

export default function FieldEvidencePage() {
  const { t } = useI18n();
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch<{ items?: EvidenceItem[] }>("/api/evidence?pageSize=48");
    if (res.ok) setItems(res.data.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="rounded-xl bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">{t("field.emptyEvidence")}</p>;
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-[var(--axon-ink)]">{t("field.tab.evidence")}</h1>
      <div className="grid grid-cols-3 gap-1.5">
        {items.map((item, idx) => {
          const src = mediaUrl(item.filePath);
          const showImg = src && isEvidenceImage(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreviewIndex(idx)}
              className="aspect-square overflow-hidden rounded-lg bg-slate-100"
            >
              {showImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={item.title} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full flex-col items-center justify-center gap-1 px-1 text-slate-400">
                  <FileText size={18} />
                  <span className="line-clamp-2 text-[10px] leading-tight">{item.title}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      {previewIndex != null && items[previewIndex] && (
        <FilePreview
          items={items.map((item) => ({
            name: item.title,
            src: mediaUrl(item.filePath),
            mime: item.mime,
          }))}
          index={previewIndex}
          onIndexChange={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  );
}
