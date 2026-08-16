"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Timeline } from "@/components/Timeline";
import { CATEGORY_COLORS, STATUS_COLORS, cn, formatDate } from "@/lib/labels";
import { mediaUrl } from "@/lib/media";
import { apiFetch, safeJsonParse } from "@/lib/api-client";
import { useI18n } from "@/components/I18nProvider";

type EvidenceItem = {
  id: string;
  title: string;
  type: string;
  location: string | null;
  filePath: string | null;
  chatText: string | null;
  status: string;
  source: string;
  category: string | null;
  severity: string | null;
  capturedAt: string;
  aiJson: string | null;
  exifJson: string | null;
  tagsJson?: string | null;
  case?: {
    id: string;
    caseNo: string;
    events: Array<{
      id: string;
      type: string;
      note: string | null;
      createdAt: string;
      actor?: { name: string } | null;
    }>;
  } | null;
};

export default function EvidencePage() {
  const { t, categoryLabels, severityLabels, evidenceStatusLabels } = useI18n();
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState({ upload: 0, whatsapp: 0, email: 0, folder: 0 });
  const [selected, setSelected] = useState<EvidenceItem | null>(null);
  const [filters, setFilters] = useState({ q: "", category: "", status: "", source: "" });
  const [importText, setImportText] = useState("");
  const [importSource, setImportSource] = useState<"WHATSAPP_IMPORT" | "EMAIL_IMPORT">("WHATSAPP_IMPORT");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function load(p = page) {
    const sp = new URLSearchParams({
      page: String(p),
      pageSize: "16",
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    });
    const res = await apiFetch<{
      items?: EvidenceItem[];
      total?: number;
      counts?: typeof counts;
    }>(`/api/evidence?${sp}`);
    if (!res.ok) {
      setItems([]);
      setTotal(0);
      return;
    }
    const data = res.data || {};
    setItems(data.items || []);
    setTotal(data.total || 0);
    setCounts(data.counts || counts);
    if (data.items?.[0] && !selected) setSelected(data.items[0]);
  }

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload(source: string) {
    setBusy(true);
    const form = new FormData();
    form.set("source", source);
    if (importText) form.set("chatText", importText);
    if (file) form.set("file", file);
    await fetch("/api/evidence", { method: "POST", body: form });
    setBusy(false);
    setImportText("");
    setFile(null);
    await load(1);
  }

  const ai = safeJsonParse<{
    category?: string;
    severity?: string;
    description?: string;
    recommendation?: string;
  } | null>(selected?.aiJson, null);
  const exif = safeJsonParse<{
    Make?: string;
    Model?: string;
    DateTimeOriginal?: string;
  } | null>(selected?.exifJson, null);
  const pages = Math.max(1, Math.ceil(total / 16));

  function evidenceTags(item: EvidenceItem) {
    const raw = safeJsonParse<unknown>(item.tagsJson, []);
    if (!Array.isArray(raw)) return [] as string[];
    return raw.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--axon-navy)]">{t("evidence.title")}</h1>
        <p className="text-sm text-slate-500">{t("evidence.subtitle")}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[240px_1fr_340px]">
        <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">{t("evidence.multiSource")}</h2>
          {(
            [
              ["UPLOAD", "evidence.src.upload", counts.upload],
              ["WHATSAPP_IMPORT", "evidence.src.wa", counts.whatsapp],
              ["EMAIL_IMPORT", "evidence.src.email", counts.email],
              ["FOLDER", "evidence.src.folder", counts.folder],
            ] as const
          ).map(([src, labelKey, count]) => (
            <div key={src} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <div className="font-medium">{t(labelKey)}</div>
              <div className="text-xs text-slate-400">+{count}</div>
            </div>
          ))}
          <div className="border-t pt-3 space-y-2">
            <select
              className="w-full rounded border px-2 py-1.5 text-xs"
              value={importSource}
              onChange={(e) => setImportSource(e.target.value as typeof importSource)}
            >
              <option value="WHATSAPP_IMPORT">{t("evidence.waManual")}</option>
              <option value="EMAIL_IMPORT">{t("evidence.emailManual")}</option>
            </select>
            <textarea
              className="w-full rounded border px-2 py-1.5 text-xs"
              rows={4}
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
              disabled={busy || (!importText && !file)}
              onClick={() => upload(file && !importText ? "UPLOAD" : importSource)}
              className="w-full rounded bg-[var(--axon-blue)] py-1.5 text-xs text-white disabled:opacity-50"
            >
              {t("evidence.importUpload")}
            </button>
            <p className="text-[10px] text-slate-400">{t("evidence.exifHint")}</p>
          </div>
        </aside>

        <section className="space-y-3">
          <form
            className="flex flex-wrap gap-2 rounded-xl border bg-white p-3"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              load(1);
            }}
          >
            <input
              className="rounded border px-2 py-1.5 text-sm"
              placeholder={t("common.keyword")}
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
            <select
              className="rounded border px-2 py-1.5 text-sm"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              <option value="">{t("common.category")}</option>
              {Object.entries(categoryLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              className="rounded border px-2 py-1.5 text-sm"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">{t("common.status")}</option>
              {Object.entries(evidenceStatusLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <button className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white">
              {t("common.filter")}
            </button>
          </form>
          <div className="text-xs text-slate-400">
            {t("evidence.showing", {
              from: (page - 1) * 16 + 1,
              to: Math.min(page * 16, total),
              total,
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className={cn(
                  "rounded-xl border bg-white p-2 text-left transition",
                  selected?.id === item.id ? "border-[var(--axon-blue)] shadow" : "border-slate-200",
                )}
              >
                <div className="relative mb-2 h-36 overflow-hidden rounded-lg bg-slate-100">
                  {mediaUrl(item.filePath) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(item.filePath)!} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">
                      {item.type}
                    </div>
                  )}
                  <span
                    className={cn(
                      "absolute bottom-2 right-2 rounded-full px-2 py-0.5 text-[10px]",
                      STATUS_COLORS[item.status],
                    )}
                  >
                    {evidenceStatusLabels[item.status] || item.status}
                  </span>
                </div>
                {item.category && (
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px]", CATEGORY_COLORS[item.category])}>
                    {categoryLabels[item.category] || item.category}
                  </span>
                )}
                <div className="mt-1 line-clamp-2 text-sm font-medium">{item.title}</div>
                {evidenceTags(item).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {evidenceTags(item)
                      .slice(0, 4)
                      .map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-800"
                        >
                          #{tag}
                        </span>
                      ))}
                  </div>
                )}
                <div className="text-xs text-slate-400">{item.location || t("common.none")}</div>
                <div className="text-xs text-slate-400">{formatDate(item.capturedAt)}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => {
                const p = page - 1;
                setPage(p);
                load(p);
              }}
              className="rounded border bg-white px-3 py-1 text-sm disabled:opacity-40"
            >
              {t("common.prev")}
            </button>
            <button
              disabled={page >= pages}
              onClick={() => {
                const p = page + 1;
                setPage(p);
                load(p);
              }}
              className="rounded border bg-white px-3 py-1 text-sm disabled:opacity-40"
            >
              {t("common.nextPage")}
            </button>
          </div>
        </section>

        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          {!selected ? (
            <p className="text-sm text-slate-400">{t("evidence.pick")}</p>
          ) : (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold">{t("evidence.detail")}</h2>
              {mediaUrl(selected.filePath) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(selected.filePath)!} alt="" className="w-full rounded-lg object-cover" />
              ) : (
                <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 whitespace-pre-wrap">
                  {selected.chatText || selected.title}
                </div>
              )}
              <div>
                <div className="font-medium">{selected.title}</div>
                <span
                  className={cn(
                    "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px]",
                    STATUS_COLORS[selected.status],
                  )}
                >
                  {evidenceStatusLabels[selected.status] || selected.status}
                </span>
                {evidenceTags(selected).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {evidenceTags(selected).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-800"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <dl className="space-y-1 text-xs text-slate-600">
                <div>{t("evidence.time", { v: formatDate(selected.capturedAt) })}</div>
                <div>{t("evidence.location", { v: selected.location || t("common.none") })}</div>
                <div>{t("evidence.source", { v: selected.source })}</div>
                {exif && (
                  <div>
                    EXIF：{exif.Make || ""} {exif.Model || ""} {exif.DateTimeOriginal || ""}
                  </div>
                )}
              </dl>
              {ai && (
                <div className="rounded-lg bg-sky-50 p-3 text-xs text-sky-900 space-y-1">
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
              {selected.case && (
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold">{t("evidence.flow")}</span>
                    <Link href={`/cases/${selected.case.id}`} className="text-[var(--axon-blue)]">
                      {selected.case.caseNo}
                    </Link>
                  </div>
                  <Timeline events={selected.case.events} />
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
