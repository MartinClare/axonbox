"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useI18n } from "@/components/I18nProvider";
import { inboxFileSrc, inboxSnippet, waitingInbox, type FieldInboxRow } from "@/lib/field-inbox";

export default function FieldInboxPage() {
  const { t, inboxStatusLabels } = useI18n();
  const [rows, setRows] = useState<FieldInboxRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await apiFetch<{ messages?: FieldInboxRow[] }>("/api/inbox?channel=WHATSAPP");
    if (res.ok) setRows(waitingInbox(res.data.messages || []));
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--axon-ink)]">{t("field.inboxTitle")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("field.inboxLead")}</p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">{t("field.noWaiting")}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const snippet = inboxSnippet(row) || (row.hasImage ? t("inbox.photo") : t("inbox.attachment"));
            const thumb = (row.files || []).find((f) => f.kind === "image");
            const thumbSrc = thumb ? inboxFileSrc(thumb, row.id, (row.files || []).indexOf(thumb)) : null;
            return (
              <Link
                key={row.id}
                href={`/m/inbox/${row.id}`}
                className="flex gap-3 rounded-xl bg-white p-3 ring-1 ring-[var(--axon-line)]"
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {thumbSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbSrc} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-slate-400">
                      <FileText size={20} />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-semibold">{row.sender}</div>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {inboxStatusLabels[row.status] || row.status}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{snippet}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {new Date(row.receivedAt).toLocaleString("zh-HK", { hour12: true, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {(row.fileCount || 0) > 0 ? ` · ${row.fileCount} ${t("field.files")}` : ""}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
