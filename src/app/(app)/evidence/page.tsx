"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EvidenceGallery } from "@/components/evidence/EvidenceGallery";
import { EvidenceImportPanel } from "@/components/evidence/EvidenceImportPanel";
import { EvidenceLightbox } from "@/components/evidence/EvidenceLightbox";
import { EvidenceToolbar } from "@/components/evidence/EvidenceToolbar";
import {
  PAGE_SIZE,
  type EvidenceFilters,
  type EvidenceItem,
} from "@/components/evidence/types";
import { apiFetch } from "@/lib/api-client";
import { useI18n } from "@/components/I18nProvider";

function EvidencePageInner() {
  const { t, categoryLabels, severityLabels, evidenceStatusLabels, caseStatusLabels } = useI18n();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("id");

  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState({ upload: 0, whatsapp: 0, email: 0, folder: 0 });
  const [filters, setFilters] = useState<EvidenceFilters>({
    q: "",
    category: "",
    status: "",
    source: "",
    linked: "",
    sort: "capturedAt",
    order: "desc",
  });
  const [busy, setBusy] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const load = useCallback(async (p: number, nextFilters: EvidenceFilters) => {
    const sp = new URLSearchParams({
      page: String(p),
      pageSize: String(PAGE_SIZE),
      sort: nextFilters.sort,
      order: nextFilters.order,
    });
    if (nextFilters.q) sp.set("q", nextFilters.q);
    if (nextFilters.category) sp.set("category", nextFilters.category);
    if (nextFilters.status) sp.set("status", nextFilters.status);
    if (nextFilters.source) sp.set("source", nextFilters.source);
    if (nextFilters.linked) sp.set("linked", nextFilters.linked);

    const res = await apiFetch<{
      items?: EvidenceItem[];
      total?: number;
      counts?: { upload: number; whatsapp: number; email: number; folder: number };
    }>(`/api/evidence?${sp}`);
    if (!res.ok) {
      setItems([]);
      setTotal(0);
      return [] as EvidenceItem[];
    }
    const data = res.data || {};
    const list = data.items || [];
    setItems(list);
    setTotal(data.total || 0);
    if (data.counts) setCounts(data.counts);
    return list;
  }, []);

  useEffect(() => {
    void load(1, filters).then((list) => {
      if (!focusId) return;
      const idx = list.findIndex((i) => i.id === focusId);
      if (idx >= 0) setLightboxIndex(idx);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload(payload: { source: string; importText: string; file: File | null }) {
    setBusy(true);
    const form = new FormData();
    form.set("source", payload.source);
    if (payload.importText) form.set("chatText", payload.importText);
    if (payload.file) form.set("file", payload.file);
    await fetch("/api/evidence", { method: "POST", body: form });
    setBusy(false);
    setPage(1);
    await load(1, filters);
  }

  function patchItem(updated: EvidenceItem) {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? { ...it, ...updated } : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const removedAt = prev.findIndex((it) => it.id === id);
      const next = prev.filter((it) => it.id !== id);
      setLightboxIndex((idx) => {
        if (idx == null || removedAt < 0) return idx;
        if (next.length === 0) return null;
        if (removedAt < idx) return idx - 1;
        return Math.min(removedAt, next.length - 1);
      });
      return next;
    });
    setTotal((n) => Math.max(0, n - 1));
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="axon-title text-2xl font-semibold">{t("evidence.title")}</h1>
        <p className="mt-1 text-sm axon-muted">{t("evidence.subtitle")}</p>
      </div>

      <EvidenceImportPanel counts={counts} busy={busy} t={t} onUpload={upload} />

      <EvidenceToolbar
        filters={filters}
        onChange={setFilters}
        onApply={() => {
          setPage(1);
          void load(1, filters);
        }}
        categoryLabels={categoryLabels}
        evidenceStatusLabels={evidenceStatusLabels}
        t={t}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          {t("evidence.showing", {
            from: total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1,
            to: Math.min(page * PAGE_SIZE, total),
            total,
          })}
        </span>
        <span>{t("evidence.galleryHint")}</span>
      </div>

      <EvidenceGallery
        items={items}
        selectedId={lightboxIndex != null ? items[lightboxIndex]?.id : null}
        evidenceStatusLabels={evidenceStatusLabels}
        caseStatusLabels={caseStatusLabels}
        categoryLabels={categoryLabels}
        t={t}
        onOpen={(item) => {
          const idx = items.findIndex((i) => i.id === item.id);
          if (idx >= 0) setLightboxIndex(idx);
        }}
      />

      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => {
            const p = page - 1;
            setPage(p);
            void load(p, filters);
          }}
          className="rounded-lg border border-[var(--axon-line)] bg-white px-3 py-1.5 text-sm disabled:opacity-40"
        >
          {t("common.prev")}
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => {
            const p = page + 1;
            setPage(p);
            void load(p, filters);
          }}
          className="rounded-lg border border-[var(--axon-line)] bg-white px-3 py-1.5 text-sm disabled:opacity-40"
        >
          {t("common.nextPage")}
        </button>
      </div>

      {lightboxIndex != null && items[lightboxIndex] && (
        <EvidenceLightbox
          items={items}
          index={lightboxIndex}
          evidenceStatusLabels={evidenceStatusLabels}
          caseStatusLabels={caseStatusLabels}
          categoryLabels={categoryLabels}
          severityLabels={severityLabels}
          t={t}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
          onItemPatched={patchItem}
          onItemDeleted={removeItem}
        />
      )}
    </div>
  );
}

export default function EvidencePage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">{t("common.loading")}</div>}>
      <EvidencePageInner />
    </Suspense>
  );
}
