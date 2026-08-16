"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Timeline } from "@/components/Timeline";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  EVIDENCE_STATUS_LABELS,
  STATUS_COLORS,
  SEVERITY_LABELS,
  cn,
  formatDate,
} from "@/lib/labels";
import { mediaUrl } from "@/lib/media";
import { apiFetch, safeJsonParse } from "@/lib/api-client";

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
    return raw.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--axon-navy)]">證據庫</h1>
        <p className="text-sm text-slate-500">每一張照片都可以成為商業證據</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[240px_1fr_340px]">
        <aside className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold">多來源照片輸入</h2>
          {[
            ["UPLOAD", "手機／平板上傳", counts.upload],
            ["WHATSAPP_IMPORT", "WhatsApp 匯入", counts.whatsapp],
            ["EMAIL_IMPORT", "郵件附件", counts.email],
            ["FOLDER", "資料夾／雲端", counts.folder],
          ].map(([src, label, count]) => (
            <div key={src} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <div className="font-medium">{label}</div>
              <div className="text-xs text-slate-400">+{count as number}</div>
            </div>
          ))}
          <div className="border-t pt-3 space-y-2">
            <select
              className="w-full rounded border px-2 py-1.5 text-xs"
              value={importSource}
              onChange={(e) => setImportSource(e.target.value as typeof importSource)}
            >
              <option value="WHATSAPP_IMPORT">WhatsApp 手動匯入</option>
              <option value="EMAIL_IMPORT">郵件手動匯入</option>
            </select>
            <textarea
              className="w-full rounded border px-2 py-1.5 text-xs"
              rows={4}
              placeholder="貼上聊天／郵件內容"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <input type="file" accept="image/*,audio/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-xs" />
            <button
              disabled={busy || (!importText && !file)}
              onClick={() => upload(file && !importText ? "UPLOAD" : importSource)}
              className="w-full rounded bg-[var(--axon-blue)] py-1.5 text-xs text-white disabled:opacity-50"
            >
              匯入／上傳
            </button>
            <p className="text-[10px] text-slate-400">
              EXIF 自動讀取時間／位置／裝置（若有）。WhatsApp／郵件為本地模擬，接口已預留。
            </p>
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
              placeholder="關鍵字"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
            <select
              className="rounded border px-2 py-1.5 text-sm"
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            >
              <option value="">分類</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              className="rounded border px-2 py-1.5 text-sm"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">狀態</option>
              {Object.entries(EVIDENCE_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white">篩選</button>
          </form>
          <div className="text-xs text-slate-400">
            顯示 {(page - 1) * 16 + 1}-{Math.min(page * 16, total)} / 共 {total} 項
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className={cn(
                  "rounded-xl border bg-white p-2 text-left transition",
                  selected?.id === item.id ? "border-[var(--axon-blue)] shadow" : "border-slate-200"
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
                  <span className={cn("absolute bottom-2 right-2 rounded-full px-2 py-0.5 text-[10px]", STATUS_COLORS[item.status])}>
                    {EVIDENCE_STATUS_LABELS[item.status]}
                  </span>
                </div>
                {item.category && (
                  <span className={cn("rounded px-1.5 py-0.5 text-[10px]", CATEGORY_COLORS[item.category])}>
                    {CATEGORY_LABELS[item.category]}
                  </span>
                )}
                <div className="mt-1 line-clamp-2 text-sm font-medium">{item.title}</div>
                {evidenceTags(item).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {evidenceTags(item).slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] text-sky-800"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-xs text-slate-400">{item.location || "—"}</div>
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
              上一頁
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
              下一頁
            </button>
          </div>
        </section>

        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          {!selected ? (
            <p className="text-sm text-slate-400">選擇一項證據查看詳情</p>
          ) : (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold">證據詳情</h2>
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
                <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[10px]", STATUS_COLORS[selected.status])}>
                  {EVIDENCE_STATUS_LABELS[selected.status]}
                </span>
                {evidenceTags(selected).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {evidenceTags(selected).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] text-sky-800"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <dl className="space-y-1 text-xs text-slate-600">
                <div>時間：{formatDate(selected.capturedAt)}</div>
                <div>位置：{selected.location || "—"}</div>
                <div>來源：{selected.source}</div>
                {exif && <div>EXIF：{exif.Make || ""} {exif.Model || ""} {exif.DateTimeOriginal || ""}</div>}
              </dl>
              {ai && (
                <div className="rounded-lg bg-sky-50 p-3 text-xs text-sky-900 space-y-1">
                  <div className="font-semibold">AI 分析結果</div>
                  <div>分類：{CATEGORY_LABELS[ai.category || ""] || ai.category || "—"}</div>
                  <div>嚴重度：{SEVERITY_LABELS[ai.severity || ""] || ai.severity || "—"}</div>
                  <div>{ai.description || ""}</div>
                  <div>建議：{ai.recommendation || ""}</div>
                </div>
              )}
              {selected.case && (
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold">流程記錄</span>
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
