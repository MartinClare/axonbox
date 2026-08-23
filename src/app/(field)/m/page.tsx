"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Camera, ChevronRight, FileText, ListChecks, Loader2 } from "lucide-react";
import { apiFetch, asArray } from "@/lib/api-client";
import { mediaUrl } from "@/lib/media";
import { useI18n } from "@/components/I18nProvider";
import { inboxFileSrc, inboxSnippet, waitingInbox, type FieldInboxRow } from "@/lib/field-inbox";
import type { EvidenceItem } from "@/components/evidence/types";

type TaskCountRow = { id: string; status: string };

export default function FieldHomePage() {
  const { t } = useI18n();
  const [inbox, setInbox] = useState<FieldInboxRow[]>([]);
  const [photos, setPhotos] = useState<EvidenceItem[]>([]);
  const [myOpenCount, setMyOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [inboxRes, evRes, tasksRes] = await Promise.all([
      apiFetch<{ messages?: FieldInboxRow[] }>("/api/inbox?channel=WHATSAPP"),
      apiFetch<{ items?: EvidenceItem[] }>("/api/evidence?pageSize=8"),
      apiFetch<TaskCountRow[]>("/api/tasks?mine=1"),
    ]);
    if (inboxRes.ok) setInbox(waitingInbox(inboxRes.data.messages || []));
    if (evRes.ok) setPhotos((evRes.data.items || []).filter((i) => Boolean(mediaUrl(i.filePath))));
    if (tasksRes.ok) {
      setMyOpenCount(asArray<TaskCountRow>(tasksRes.data).filter((task) => task.status !== "DONE").length);
    }
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
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[var(--axon-ink)]">{t("field.homeTitle")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("field.homeLead")}</p>
      </div>

      <Link
        href="/m/capture"
        className="flex items-center gap-3 rounded-2xl bg-[var(--axon-accent)] px-4 py-4 text-white shadow-md shadow-orange-900/10"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20">
          <Camera size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">{t("field.shot")}</span>
          <span className="text-xs text-white/80">{t("field.saveEvidence")}</span>
        </span>
        <ChevronRight size={18} />
      </Link>

      <Link
        href="/m/tasks"
        className="flex items-center gap-3 rounded-2xl bg-white px-4 py-4 ring-1 ring-[var(--axon-line)]"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--axon-sand)] text-[var(--axon-ink)]">
          <ListChecks size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-[var(--axon-ink)]">{t("field.myTasks")}</span>
          <span className="text-xs text-slate-500">
            {myOpenCount > 0 ? `${myOpenCount}` : t("field.emptyMyTasks")}
          </span>
        </span>
        <ChevronRight size={18} className="text-slate-300" />
      </Link>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--axon-ink)]">
            {t("field.waitingWa")}
            {inbox.length ? ` · ${inbox.length}` : ""}
          </h2>
          <Link href="/m/inbox" className="text-xs font-medium text-[var(--axon-blue)]">
            {t("field.openAll")}
          </Link>
        </div>
        {inbox.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">{t("field.noWaiting")}</p>
        ) : (
          <div className="space-y-2">
            {inbox.slice(0, 4).map((row) => (
              <InboxCard key={row.id} row={row} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--axon-ink)]">{t("field.recentEvidence")}</h2>
          <Link href="/m/evidence" className="text-xs font-medium text-[var(--axon-blue)]">
            {t("field.openAll")}
          </Link>
        </div>
        {photos.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">{t("field.emptyEvidence")}</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            {photos.slice(0, 6).map((item) => {
              const src = mediaUrl(item.filePath);
              return (
                <Link
                  key={item.id}
                  href="/m/evidence"
                  className="aspect-square overflow-hidden rounded-lg bg-slate-100"
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-slate-400">
                      <FileText size={16} />
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <Link href="/install" className="block text-center text-xs text-slate-400">
        {t("field.installHint")}
      </Link>
    </div>
  );
}

function InboxCard({ row }: { row: FieldInboxRow }) {
  const { t, inboxStatusLabels } = useI18n();
  const snippet = inboxSnippet(row) || (row.hasImage ? t("inbox.photo") : t("inbox.attachment"));
  const thumb = (row.files || []).find((f) => f.kind === "image");
  const thumbSrc = thumb ? inboxFileSrc(thumb, row.id, (row.files || []).indexOf(thumb)) : null;
  return (
    <Link href={`/m/inbox/${row.id}`} className="flex gap-3 rounded-xl bg-white p-3 ring-1 ring-[var(--axon-line)]">
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
        {thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-slate-400">
            <FileText size={18} />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-sm font-medium text-[var(--axon-ink)]">{row.sender}</div>
          <span className="shrink-0 text-[10px] text-slate-400">{inboxStatusLabels[row.status] || row.status}</span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{snippet}</p>
        {(row.fileCount || 0) > 0 && (
          <p className="mt-1 text-[11px] text-slate-400">
            {row.fileCount} {t("field.files")}
          </p>
        )}
      </div>
    </Link>
  );
}
