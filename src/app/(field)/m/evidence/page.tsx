"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, X } from "lucide-react";
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
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await apiFetch<{ items?: EvidenceItem[] }>("/api/evidence?pageSize=48");
    if (res.ok) setItems(res.data.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteAt(index: number) {
    const item = items[index];
    if (!item) return;
    setError("");
    const res = await apiFetch(`/api/evidence/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError(res.error || t("evidence.deleteFail"));
      return;
    }
    const next = items.filter((x) => x.id !== item.id);
    setItems(next);
    if (next.length === 0) {
      setPreviewIndex(null);
      return;
    }
    setPreviewIndex(Math.min(index, next.length - 1));
  }

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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-3 gap-1.5">
        {items.map((item, idx) => {
          const src = mediaUrl(item.filePath);
          const showImg = src && isEvidenceImage(item);
          return (
            <div key={item.id} className="relative aspect-square">
              <button
                type="button"
                onClick={() => setPreviewIndex(idx)}
                className="h-full w-full overflow-hidden rounded-lg bg-slate-100"
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
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!window.confirm(t("evidence.deleteConfirm"))) return;
                  void deleteAt(idx);
                }}
                className="absolute right-1 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/75 text-white shadow-sm"
                aria-label={t("evidence.delete")}
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
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
          onDelete={deleteAt}
        />
      )}
    </div>
  );
}
