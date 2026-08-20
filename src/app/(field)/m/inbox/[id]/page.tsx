"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, FileText, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { FilePreview } from "@/components/FilePreview";
import { useI18n } from "@/components/I18nProvider";
import { resolveInboxActionItems } from "@/lib/inbox-actions";
import { inboxFileSrc, type FieldInboxFile, type FieldInboxRow } from "@/lib/field-inbox";
import { SEVERITY_COLORS, cn } from "@/lib/labels";

type ExtractResult = {
  title?: string;
  description?: string;
  category?: string;
  severity?: string;
  location?: string;
  recommendation?: string;
  actionItems?: Array<{ title: string; detail?: string }>;
};

export default function FieldInboxDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, categoryLabels, severityLabels } = useI18n();
  const [row, setRow] = useState<FieldInboxRow | null>(null);
  const [extract, setExtract] = useState<ExtractResult | null>(null);
  const [busy, setBusy] = useState<"analyze" | "approve" | "dismiss" | null>(null);
  const [error, setError] = useState("");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch<FieldInboxRow>(`/api/inbox/${id}`);
    if (!res.ok) {
      setError(t("common.failed"));
      return;
    }
    setRow(res.data);
    if (res.data.aiJson) {
      try {
        setExtract(JSON.parse(res.data.aiJson));
      } catch {
        setExtract(null);
      }
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function analyze() {
    setBusy("analyze");
    setError("");
    const res = await fetch(`/api/inbox/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "analyze" }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(t("inbox.analyzeFail"));
      return;
    }
    const data = await res.json();
    setExtract(data.extract);
    setRow(data.message);
  }

  async function approve() {
    if (!row) return;
    const points = resolveInboxActionItems(extract, row.body);
    setBusy("approve");
    setError("");
    const res = await fetch(`/api/inbox/${id}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ createTask: true, actionItems: points }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(t("inbox.toCaseFail"));
      return;
    }
    const data = await res.json();
    if (data.case?.id) router.push(`/cases/${data.case.id}`);
    else router.push("/m/inbox");
  }

  async function dismiss() {
    setBusy("dismiss");
    const res = await fetch(`/api/inbox/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(t("common.failed"));
      return;
    }
    router.push("/m/inbox");
  }

  if (!row) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  const files = row.files || [];

  return (
    <div className="space-y-4">
      <Link href="/m/inbox" className="inline-flex items-center gap-1 text-sm text-[var(--axon-blue)]">
        <ChevronLeft size={16} />
        {t("field.back")}
      </Link>

      <div>
        <div className="text-sm font-semibold text-[var(--axon-ink)]">{row.sender}</div>
        <div className="text-xs text-slate-400">{new Date(row.receivedAt).toLocaleString("zh-HK")}</div>
      </div>

      {row.body.trim() ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{row.body}</p>
      ) : (
        <p className="text-sm text-slate-400">{t("inbox.noText")}</p>
      )}

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{t("field.files")}</h2>
        {files.length === 0 ? (
          <p className="text-sm text-slate-500">{t("field.noFiles")}</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {files.map((f, idx) =>
                f.kind === "image" ? (
                  <FileChip key={`${f.name}-${idx}`} file={f} messageId={row.id} index={idx} onOpen={() => setPreviewIndex(idx)} />
                ) : null,
              )}
            </div>
            {files.map((f, idx) =>
              f.kind === "image" ? null : (
                <FileChip key={`${f.name}-${idx}`} file={f} messageId={row.id} index={idx} onOpen={() => setPreviewIndex(idx)} />
              ),
            )}
          </div>
        )}
      </section>

      {extract?.title && (
        <section className="axon-panel space-y-2 p-4">
          <h2 className="font-semibold text-[var(--axon-ink)]">{extract.title}</h2>
          {extract.description && <p className="text-sm text-slate-600">{extract.description}</p>}
          <div className="flex flex-wrap gap-2 text-xs">
            {extract.category && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5">
                {categoryLabels[extract.category] || extract.category}
              </span>
            )}
            {extract.severity && (
              <span className={cn("rounded-md bg-slate-100 px-2 py-0.5", SEVERITY_COLORS[extract.severity])}>
                {severityLabels[extract.severity] || extract.severity}
              </span>
            )}
          </div>
          {extract.recommendation && <p className="text-sm text-slate-700">{extract.recommendation}</p>}
        </section>
      )}

      {error && <p className="text-sm text-[var(--axon-danger)]">{error}</p>}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void analyze()}
          className="axon-btn axon-btn-ghost h-11"
        >
          {busy === "analyze" ? <Loader2 size={16} className="animate-spin" /> : null}
          {t("field.analyze")}
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void dismiss()}
          className="axon-btn axon-btn-ghost h-11"
        >
          {t("field.dismiss")}
        </button>
      </div>
      <button
        type="button"
        disabled={Boolean(busy)}
        onClick={() => void approve()}
        className="axon-btn axon-btn-primary h-12 w-full text-base"
      >
        {busy === "approve" ? <Loader2 size={18} className="animate-spin" /> : null}
        {t("field.approve")}
      </button>

      {previewIndex != null && files[previewIndex] && (
        <FilePreview
          items={files.map((f, idx) => ({
            name: f.name,
            src: inboxFileSrc(f, row.id, idx),
            mime: f.mime,
          }))}
          index={previewIndex}
          onIndexChange={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </div>
  );
}

function FileChip({
  file,
  messageId,
  index,
  onOpen,
}: {
  file: FieldInboxFile;
  messageId: string;
  index: number;
  onOpen: () => void;
}) {
  const src = inboxFileSrc(file, messageId, index);
  if (file.kind === "image") {
    return (
      <button type="button" onClick={onOpen} className="overflow-hidden rounded-xl ring-1 ring-[var(--axon-line)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={file.name} className="h-36 w-full object-cover" />
        <div className="truncate px-2 py-1 text-[11px] text-slate-500">{file.name}</div>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-left text-sm text-[var(--axon-blue)]"
    >
      <FileText size={16} className="shrink-0 text-slate-500" />
      <span className="min-w-0 flex-1 truncate underline">{file.name}</span>
    </button>
  );
}
