"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, Paperclip, Trash2, X } from "lucide-react";
import { isProbablyImage } from "@/lib/media";
import { useI18n } from "@/components/I18nProvider";

export type PreviewFile = {
  name: string;
  src: string | null;
  mime?: string | null;
};

function isImage(f: PreviewFile) {
  return isProbablyImage({ type: f.mime || undefined, name: f.name });
}

function isPdf(f: PreviewFile) {
  return (f.mime || "").includes("pdf") || /\.pdf($|\?)/i.test(f.name) || /\.pdf($|\?)/i.test(f.src || "");
}

function isVideo(f: PreviewFile) {
  return (f.mime || "").startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(f.name);
}

function isAudio(f: PreviewFile) {
  return (f.mime || "").startsWith("audio/") || /\.(mp3|wav|webm|m4a|ogg|opus)$/i.test(f.name);
}

export function FilePreview({
  items,
  index,
  onIndexChange,
  onClose,
  onDelete,
}: {
  items: PreviewFile[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** When set, shows a delete control (e.g. field evidence). */
  onDelete?: (index: number) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const item = items[index];
  const src = item?.src || null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onIndexChange(Math.max(0, index - 1));
      if (e.key === "ArrowRight") onIndexChange(Math.min(items.length - 1, index + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onIndexChange]);

  if (!item) return null;

  async function handleDelete() {
    if (!onDelete || deleting) return;
    if (!window.confirm(t("evidence.deleteConfirm"))) return;
    setDeleting(true);
    try {
      await onDelete(index);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/85 p-3"
      role="dialog"
      aria-label={t("tasks.preview")}
      onClick={onClose}
    >
      <div className="flex shrink-0 items-center gap-2 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1 truncate text-sm font-medium">
          {item.name}
          {items.length > 1 ? `  ${index + 1}/${items.length}` : ""}
        </div>
        {src && (
          <>
            <a
              href={src}
              download={item.name}
              className="rounded-lg p-2 hover:bg-white/10"
              title={t("tasks.download")}
            >
              <Download size={18} />
            </a>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg p-2 hover:bg-white/10"
              title={t("tasks.openFile")}
            >
              <ExternalLink size={18} />
            </a>
          </>
        )}
        {onDelete && (
          <button
            type="button"
            disabled={deleting}
            className="rounded-lg p-2 text-red-200 hover:bg-red-500/20 disabled:opacity-50"
            onClick={() => void handleDelete()}
            title={t("evidence.delete")}
            aria-label={t("evidence.delete")}
          >
            {deleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
          </button>
        )}
        <button type="button" className="rounded-lg p-2 hover:bg-white/10" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {items.length > 1 && (
          <button
            type="button"
            className="absolute left-1 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 disabled:opacity-30"
            onClick={() => onIndexChange(Math.max(0, index - 1))}
            disabled={index === 0}
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="max-h-full max-w-full px-12">
          {!src ? (
            <p className="text-sm text-white/70">{item.name}</p>
          ) : isImage(item) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={item.name} className="max-h-[80vh] max-w-full rounded object-contain" />
          ) : isPdf(item) ? (
            <div className="flex h-[80vh] w-[min(100vw-4rem,900px)] flex-col overflow-hidden rounded bg-white">
              <object data={src} type="application/pdf" className="min-h-0 flex-1">
                <iframe title={item.name} src={src} className="h-full w-full" />
              </object>
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 border-t border-slate-200 px-3 py-2 text-center text-sm text-[var(--axon-blue)]"
              >
                {t("tasks.openFile")}
              </a>
            </div>
          ) : isVideo(item) ? (
            <video src={src} controls className="max-h-[80vh] max-w-full rounded" />
          ) : isAudio(item) ? (
            <audio src={src} controls className="w-[min(100%,480px)]" />
          ) : (
            <div className="rounded-xl bg-white p-6 text-center text-slate-700">
              <Paperclip className="mx-auto mb-3 text-slate-400" size={28} />
              <div className="mb-3 text-sm font-medium">{item.name}</div>
              <a href={src} target="_blank" rel="noreferrer" className="text-sm text-[var(--axon-blue)]">
                {t("tasks.openFile")}
              </a>
            </div>
          )}
        </div>
        {items.length > 1 && (
          <button
            type="button"
            className="absolute right-1 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 disabled:opacity-30"
            onClick={() => onIndexChange(Math.min(items.length - 1, index + 1))}
            disabled={index === items.length - 1}
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>
      {onDelete && (
        <div className="shrink-0 pt-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void handleDelete()}
            className="mx-auto flex w-full max-w-sm items-center justify-center gap-2 rounded-xl bg-red-600/90 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {t("evidence.delete")}
          </button>
        </div>
      )}
    </div>
  );
}
