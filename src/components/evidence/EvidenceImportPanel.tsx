"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

type Counts = { upload: number; whatsapp: number; email: number; folder: number };

type Props = {
  counts: Counts;
  busy: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
  onUpload: (payload: {
    source: string;
    importText: string;
    file: File | null;
  }) => Promise<void>;
};

export function EvidenceImportPanel({ counts, busy, t, onUpload }: Props) {
  const [open, setOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importSource, setImportSource] = useState<"WHATSAPP_IMPORT" | "EMAIL_IMPORT">(
    "WHATSAPP_IMPORT",
  );
  const [file, setFile] = useState<File | null>(null);

  async function submit() {
    await onUpload({
      source: file && !importText ? "UPLOAD" : importSource,
      importText,
      file,
    });
    setImportText("");
    setFile(null);
  }

  return (
    <div className="rounded-xl border border-[var(--axon-line)] bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-[var(--axon-ink)]"
      >
        <span>
          {t("evidence.importToggle")}
          <span className="ml-2 font-normal text-slate-400">
            {counts.upload + counts.whatsapp + counts.email + counts.folder}
          </span>
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="space-y-3 border-t border-[var(--axon-line)] px-4 py-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                ["UPLOAD", "evidence.src.upload", counts.upload],
                ["WHATSAPP_IMPORT", "evidence.src.wa", counts.whatsapp],
                ["EMAIL_IMPORT", "evidence.src.email", counts.email],
                ["FOLDER", "evidence.src.folder", counts.folder],
              ] as const
            ).map(([, labelKey, count]) => (
              <div key={labelKey} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                <div className="font-medium text-slate-700">{t(labelKey)}</div>
                <div className="text-slate-400">+{count}</div>
              </div>
            ))}
          </div>
          <select
            className="axon-input min-h-0 py-1.5 text-sm"
            value={importSource}
            onChange={(e) => setImportSource(e.target.value as typeof importSource)}
          >
            <option value="WHATSAPP_IMPORT">{t("evidence.waManual")}</option>
            <option value="EMAIL_IMPORT">{t("evidence.emailManual")}</option>
          </select>
          <textarea
            className="axon-input min-h-0 py-2 text-sm"
            rows={3}
            placeholder={t("evidence.pastePh")}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <input
            type="file"
            accept="image/*,audio/*,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-xs"
          />
          <button
            type="button"
            disabled={busy || (!importText && !file)}
            onClick={submit}
            className="axon-btn axon-btn-primary w-full disabled:opacity-50"
          >
            {t("evidence.importUpload")}
          </button>
          <p className="text-[10px] text-slate-400">{t("evidence.exifHint")}</p>
        </div>
      )}
    </div>
  );
}
