"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Link2,
  Link2Off,
  Loader2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Timeline } from "@/components/Timeline";
import { STATUS_COLORS, cn, formatDate } from "@/lib/labels";
import { mediaUrl } from "@/lib/media";
import { apiFetch, safeJsonParse } from "@/lib/api-client";
import {
  evidenceTags,
  isEvidenceImage,
  type EvidenceCaseDetail,
  type EvidenceItem,
} from "./types";

type CaseOption = {
  id: string;
  caseNo: string;
  title: string;
  status: string;
};

type Props = {
  items: EvidenceItem[];
  index: number;
  evidenceStatusLabels: Record<string, string>;
  caseStatusLabels: Record<string, string>;
  categoryLabels: Record<string, string>;
  severityLabels: Record<string, string>;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  onItemPatched: (item: EvidenceItem) => void;
};

export function EvidenceLightbox({
  items,
  index,
  evidenceStatusLabels,
  caseStatusLabels,
  categoryLabels,
  severityLabels,
  t,
  onClose,
  onIndexChange,
  onItemPatched,
}: Props) {
  const item = items[index];
  const [detail, setDetail] = useState<EvidenceItem | null>(item || null);
  const [busy, setBusy] = useState(false);
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [caseQuery, setCaseQuery] = useState("");
  const [linking, setLinking] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const loadDetail = useCallback(async (id: string) => {
    const res = await apiFetch<EvidenceItem>(`/api/evidence/${id}`);
    if (res.ok && res.data) {
      setDetail(res.data);
      onItemPatched(res.data);
    }
  }, [onItemPatched]);

  useEffect(() => {
    if (!item) return;
    setDetail(item);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setLinking(false);
    void loadDetail(item.id);
  }, [item, loadDetail]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onIndexChange(Math.max(0, index - 1));
      if (e.key === "ArrowRight") onIndexChange(Math.min(items.length - 1, index + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onIndexChange]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function loadCases(q = "") {
    const sp = new URLSearchParams({ brief: "1" });
    if (q.trim()) sp.set("q", q.trim());
    const res = await apiFetch<CaseOption[]>(`/api/cases?${sp}`);
    if (res.ok) setCases(Array.isArray(res.data) ? res.data : []);
  }

  async function linkCase(caseId: string | null) {
    if (!detail) return;
    setBusy(true);
    const res = await apiFetch<EvidenceItem>(`/api/evidence/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId }),
    });
    setBusy(false);
    if (res.ok && res.data) {
      setDetail(res.data);
      onItemPatched(res.data);
      setLinking(false);
      await loadDetail(detail.id);
    }
  }

  if (!item || !detail) return null;

  const url = mediaUrl(detail.filePath);
  const showImg = url && isEvidenceImage(detail);
  const tags = evidenceTags(detail);
  const ai = safeJsonParse<{
    category?: string;
    severity?: string;
    description?: string;
    recommendation?: string;
  } | null>(detail.aiJson, null);
  const exif = safeJsonParse<{
    Make?: string;
    Model?: string;
    DateTimeOriginal?: string;
  } | null>(detail.exifJson, null);
  const caseDetail = detail.case as EvidenceCaseDetail | null | undefined;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/92 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={t("evidence.lightbox.aria")}
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{detail.title}</div>
          <div className="text-xs text-white/55">
            {index + 1} / {items.length} · {formatDate(detail.capturedAt)}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {showImg && (
            <>
              <button
                type="button"
                className="rounded-lg p-2 text-white/80 hover:bg-white/10"
                onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
                aria-label={t("evidence.lightbox.zoomOut")}
              >
                <ZoomOut size={18} />
              </button>
              <button
                type="button"
                className="rounded-lg p-2 text-white/80 hover:bg-white/10"
                onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                aria-label={t("evidence.lightbox.zoomIn")}
              >
                <ZoomIn size={18} />
              </button>
            </>
          )}
          <button
            type="button"
            className="rounded-lg p-2 text-white/80 hover:bg-white/10"
            onClick={onClose}
            aria-label={t("evidence.lightbox.close")}
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          {index > 0 && (
            <button
              type="button"
              className="absolute left-3 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              onClick={() => onIndexChange(index - 1)}
              aria-label={t("evidence.lightbox.prev")}
            >
              <ChevronLeft size={22} />
            </button>
          )}
          {index < items.length - 1 && (
            <button
              type="button"
              className="absolute right-3 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
              onClick={() => onIndexChange(index + 1)}
              aria-label={t("evidence.lightbox.next")}
            >
              <ChevronRight size={22} />
            </button>
          )}
          {showImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url!}
              alt=""
              draggable={false}
              className={cn(
                "max-h-full max-w-full select-none object-contain",
                zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
              )}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transition: drag.current ? "none" : "transform 0.12s ease-out",
              }}
              onWheel={(e) => {
                e.preventDefault();
                setZoom((z) => Math.min(4, Math.max(1, z + (e.deltaY < 0 ? 0.15 : -0.15))));
              }}
              onDoubleClick={() => {
                if (zoom > 1) {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                } else setZoom(2);
              }}
              onPointerDown={(e) => {
                if (zoom <= 1) return;
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                setPan({
                  x: drag.current.px + (e.clientX - drag.current.x),
                  y: drag.current.py + (e.clientY - drag.current.y),
                });
              }}
              onPointerUp={() => {
                drag.current = null;
              }}
            />
          ) : (
            <div className="max-h-[70vh] max-w-2xl overflow-auto whitespace-pre-wrap rounded-xl bg-white/10 p-6 text-sm text-white/90">
              {detail.chatText || detail.title}
            </div>
          )}
        </div>

        <aside className="max-h-[42vh] w-full shrink-0 overflow-y-auto border-t border-white/10 bg-black/40 p-4 lg:max-h-none lg:w-[360px] lg:border-l lg:border-t-0">
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-1.5">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px]",
                  STATUS_COLORS[detail.status] || "bg-white/15",
                )}
              >
                {evidenceStatusLabels[detail.status] || detail.status}
              </span>
              {detail.category && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px]">
                  {categoryLabels[detail.category] || detail.category}
                </span>
              )}
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[11px] text-sky-100">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <dl className="space-y-1 text-xs text-white/70">
              <div>{t("evidence.time", { v: formatDate(detail.capturedAt) })}</div>
              <div>{t("evidence.location", { v: detail.location || t("common.none") })}</div>
              <div>{t("evidence.source", { v: detail.source })}</div>
              {exif && (
                <div>
                  EXIF: {exif.Make || ""} {exif.Model || ""} {exif.DateTimeOriginal || ""}
                </div>
              )}
            </dl>

            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-white/50">
                <span>{t("evidence.caseLink")}</span>
                {busy && <Loader2 size={14} className="animate-spin" />}
              </div>
              {detail.case ? (
                <div className="space-y-2">
                  <Link
                    href={`/cases/${detail.case.id}`}
                    className="block text-sm font-semibold text-[var(--axon-signal)] hover:underline"
                  >
                    {detail.case.caseNo} · {detail.case.title}
                  </Link>
                  <div className="text-xs text-white/65">
                    {t("evidence.caseStatus", {
                      v: caseStatusLabels[detail.case.status] || detail.case.status,
                    })}
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => linkCase(null)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-2.5 py-1.5 text-xs hover:bg-white/10"
                  >
                    <Link2Off size={13} />
                    {t("evidence.unlinkCase")}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-white/55">{t("evidence.unlinkedHint")}</p>
                  {!linking ? (
                    <button
                      type="button"
                      onClick={() => {
                        setLinking(true);
                        void loadCases();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs hover:bg-white/25"
                    >
                      <Link2 size={13} />
                      {t("evidence.linkCase")}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <input
                        className="w-full rounded-lg border border-white/20 bg-black/30 px-2 py-1.5 text-xs text-white outline-none"
                        placeholder={t("evidence.caseSearchPh")}
                        value={caseQuery}
                        onChange={(e) => {
                          setCaseQuery(e.target.value);
                          void loadCases(e.target.value);
                        }}
                      />
                      <div className="max-h-40 space-y-1 overflow-y-auto">
                        {cases.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            disabled={busy}
                            onClick={() => linkCase(c.id)}
                            className="block w-full rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/10"
                          >
                            <span className="font-semibold">{c.caseNo}</span>
                            <span className="text-white/55">
                              {" · "}
                              {caseStatusLabels[c.status] || c.status}
                            </span>
                            <div className="truncate text-white/70">{c.title}</div>
                          </button>
                        ))}
                        {cases.length === 0 && (
                          <p className="text-xs text-white/40">{t("evidence.noCases")}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="text-xs text-white/50 hover:text-white"
                        onClick={() => setLinking(false)}
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {ai && (
              <div className="rounded-xl bg-sky-500/15 p-3 text-xs text-sky-50 space-y-1">
                <div className="font-semibold">{t("evidence.ai")}</div>
                <div>
                  {t("evidence.aiCat", {
                    v: categoryLabels[ai.category || ""] || ai.category || t("common.none"),
                  })}
                </div>
                <div>
                  {t("evidence.aiSev", {
                    v: severityLabels[ai.severity || ""] || ai.severity || t("common.none"),
                  })}
                </div>
                <div>{ai.description || ""}</div>
                <div>{t("evidence.aiRec", { v: ai.recommendation || "" })}</div>
              </div>
            )}

            {caseDetail?.events && caseDetail.events.length > 0 && (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                  {t("evidence.flow")}
                </div>
                <div className="rounded-xl bg-white/5 p-2 text-[var(--axon-ink)]">
                  <Timeline events={caseDetail.events} />
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
