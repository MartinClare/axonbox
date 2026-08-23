"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FolderPlus,
  Link2,
  Link2Off,
  Loader2,
  Replace,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Timeline } from "@/components/Timeline";
import { STATUS_COLORS, cn, formatDate } from "@/lib/labels";
import { mediaUrl } from "@/lib/media";
import { apiFetch, safeJsonParse } from "@/lib/api-client";
import { formatCoords, formatHeading, osmLink } from "@/lib/capture-geo";
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
  onItemDeleted: (id: string) => void;
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
  onItemDeleted,
}: Props) {
  const router = useRouter();
  const item = items[index];
  const [detail, setDetail] = useState<EvidenceItem | null>(item || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [caseQuery, setCaseQuery] = useState("");
  const [linking, setLinking] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [imgRev, setImgRev] = useState(0);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDetail = useCallback(
    async (id: string) => {
      const res = await apiFetch<EvidenceItem>(`/api/evidence/${id}`);
      if (res.ok && res.data) {
        setDetail(res.data);
        onItemPatched(res.data);
      }
    },
    [onItemPatched],
  );

  useEffect(() => {
    if (!item) return;
    setDetail(item);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setLinking(false);
    setError("");
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
    setError("");
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
    } else {
      setError(res.ok ? "" : res.error);
    }
  }

  async function createCase() {
    if (!detail) return;
    setBusy(true);
    setError("");
    const ai = safeJsonParse<{
      category?: string;
      severity?: string;
      description?: string;
      recommendation?: string;
      location?: string;
      title?: string;
    } | null>(detail.aiJson, null);

    const res = await apiFetch<{ id: string }>("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: detail.title || ai?.title || t("evidence.createCaseFallbackTitle"),
        description: ai?.description || detail.chatText || detail.title,
        category: detail.category || ai?.category || "OTHER",
        severity: detail.severity || ai?.severity || "MEDIUM",
        location: detail.location || ai?.location || undefined,
        recommendation: ai?.recommendation,
        sourceType: detail.type === "PHOTO" ? "PHOTO" : "MANUAL",
        evidenceId: detail.id,
        createTask: true,
        dueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      }),
    });
    setBusy(false);
    if (!res.ok || !res.data?.id) {
      setError(res.ok ? t("evidence.createCaseFail") : res.error || t("evidence.createCaseFail"));
      return;
    }
    router.push(`/cases/${res.data.id}`);
  }

  async function replacePhoto(file: File) {
    if (!detail) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("file", file);
    const res = await apiFetch<EvidenceItem>(`/api/evidence/${detail.id}`, {
      method: "PATCH",
      body: form,
    });
    setBusy(false);
    if (!res.ok || !res.data) {
      setError(res.ok ? t("evidence.replaceFail") : res.error || t("evidence.replaceFail"));
      return;
    }
    setDetail(res.data);
    onItemPatched(res.data);
    setImgRev(Date.now());
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  async function deleteEvidence() {
    if (!detail) return;
    if (!window.confirm(t("evidence.deleteConfirm"))) return;
    setBusy(true);
    setError("");
    const res = await apiFetch(`/api/evidence/${detail.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError(res.error || t("evidence.deleteFail"));
      return;
    }
    onItemDeleted(detail.id);
  }

  async function downloadPhoto() {
    if (!detail?.filePath) return;
    const url = mediaUrl(detail.filePath);
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      const name =
        detail.filePath.split("/").pop() ||
        `${detail.title || "evidence"}.jpg`;
      a.download = name;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError(t("evidence.downloadFail"));
    }
  }

  if (!item || !detail) return null;

  const baseUrl = mediaUrl(detail.filePath);
  const url = baseUrl ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}t=${imgRev || detail.id}` : null;
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
  const linked = Boolean(detail.case);

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

      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/50 px-4 py-2.5">
        {linked && detail.case ? (
          <Link
            href={`/cases/${detail.case.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--axon-accent)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            {t("evidence.openCase")}
          </Link>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void createCase()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--axon-accent)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            <FolderPlus size={14} />
            {t("evidence.createCase")}
          </button>
        )}

        {!linked && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setLinking(true);
              void loadCases();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/15 disabled:opacity-50"
          >
            <Link2 size={14} />
            {t("evidence.linkCase")}
          </button>
        )}

        {linked && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void linkCase(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/15 disabled:opacity-50"
          >
            <Link2Off size={14} />
            {t("evidence.unlinkCase")}
          </button>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/15 disabled:opacity-50"
        >
          <Replace size={14} />
          {t("evidence.replace")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void replacePhoto(file);
          }}
        />

        {detail.filePath && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void downloadPhoto()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/15 disabled:opacity-50"
          >
            <Download size={14} />
            {t("evidence.download")}
          </button>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void deleteEvidence()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-xs font-medium text-red-100 hover:bg-red-500/25 disabled:opacity-50"
        >
          <Trash2 size={14} />
          {t("evidence.delete")}
        </button>

        {busy && <Loader2 size={16} className="animate-spin text-white/60" />}
      </div>

      {error && (
        <div className="border-b border-red-400/30 bg-red-500/15 px-4 py-2 text-xs text-red-100">
          {error}
        </div>
      )}

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
            {!linked && (
              <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/65">
                {t("evidence.actionHint")}
              </p>
            )}

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
              {detail.lat != null && detail.lng != null && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    {t("evidence.coords", { v: formatCoords(detail.lat, detail.lng) })}
                  </span>
                  {detail.headingDeg != null && (
                    <span>{t("evidence.heading", { v: formatHeading(detail.headingDeg) })}</span>
                  )}
                  <a
                    href={osmLink(detail.lat, detail.lng)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--axon-signal)] hover:underline"
                  >
                    {t("capture.geoOpenMap")}
                  </a>
                </div>
              )}
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
                </div>
              ) : linking ? (
                <div className="space-y-2">
                  <input
                    className="w-full rounded-lg border border-white/20 bg-black/30 px-2 py-1.5 text-xs text-white outline-none"
                    placeholder={t("evidence.caseSearchPh")}
                    value={caseQuery}
                    onChange={(e) => {
                      setCaseQuery(e.target.value);
                      void loadCases(e.target.value);
                    }}
                    autoFocus
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
              ) : (
                <p className="text-xs text-white/55">{t("evidence.unlinkedHint")}</p>
              )}
            </div>

            {ai && (
              <div className="space-y-1 rounded-xl bg-sky-500/15 p-3 text-xs text-sky-50">
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
