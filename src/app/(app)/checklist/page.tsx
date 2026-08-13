"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckSquare, Loader2, Play } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/labels";

type Item = { id: string; text: string; required?: boolean; checked?: boolean; note?: string };
type Template = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  sourceRef: string | null;
  itemsJson: string;
};
type Run = {
  id: string;
  title: string;
  status: string;
  itemsJson: string;
  note: string | null;
  template?: { name: string };
};

export default function ChecklistPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [active, setActive] = useState<Run | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const res = await apiFetch<{ templates: Template[]; runs: Run[] }>("/api/checklist");
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setTemplates(res.data?.templates || []);
    setRuns(res.data?.runs || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function start(templateId: string) {
    setBusy(true);
    const res = await apiFetch<Run>("/api/checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start", templateId }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setActive(res.data!);
    setItems(JSON.parse(res.data!.itemsJson || "[]"));
    await load();
  }

  async function save(complete = false) {
    if (!active) return;
    setBusy(true);
    const res = await apiFetch<Run>("/api/checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save",
        id: active.id,
        items,
        complete,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setActive(res.data!);
    setMsg(complete ? "已完成點檢" : "已儲存");
    await load();
  }

  const doneCount = items.filter((i) => i.checked).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="axon-title text-2xl font-semibold">現場 Checklist</h1>
        <p className="mt-1 text-sm axon-muted">安全／開挖／完工點檢 · 可對照 HyD／XPMS 合規要點</p>
        {msg && <p className="mt-1 text-sm text-emerald-700">{msg}</p>}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">點檢模板</h2>
          {templates.map((t) => {
            const count = JSON.parse(t.itemsJson || "[]").length;
            return (
              <div key={t.id} className="axon-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-[var(--axon-ink)]">{t.name}</div>
                    <p className="mt-1 text-xs text-slate-500">{t.description}</p>
                    {t.sourceRef && (
                      <p className="mt-1 text-[11px] text-slate-400">依據：{t.sourceRef}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">{count} 項</p>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => start(t.id)}
                    className="axon-btn axon-btn-primary shrink-0"
                  >
                    <Play size={14} />
                    開始
                  </button>
                </div>
              </div>
            );
          })}
          {!templates.length && (
            <p className="text-sm text-slate-400">尚無模板（請執行資料庫 seed）</p>
          )}

          <h2 className="pt-2 text-sm font-semibold">最近記錄</h2>
          <div className="axon-panel divide-y">
            {runs.map((r) => (
              <button
                key={r.id}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  setActive(r);
                  setItems(JSON.parse(r.itemsJson || "[]"));
                }}
              >
                <span>
                  {r.title}
                  <span className="ml-2 text-xs text-slate-400">{r.template?.name}</span>
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px]",
                    r.status === "DONE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
                  )}
                >
                  {r.status === "DONE" ? "完成" : "進行中"}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="axon-panel p-5">
          {!active ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center text-sm text-slate-500">
              <CheckSquare className="mb-2 text-slate-300" />
              選擇模板開始現場點檢
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-[var(--axon-ink)]">{active.title}</h2>
                <span className="text-xs text-slate-500">
                  {doneCount}/{items.length}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <label
                    key={item.id || idx}
                    className="flex cursor-pointer gap-3 rounded-xl border border-[var(--axon-line)] px-3 py-3"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={Boolean(item.checked)}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...item, checked: e.target.checked };
                        setItems(next);
                      }}
                    />
                    <span className="text-sm">
                      {item.text}
                      {item.required && (
                        <span className="ml-1 text-[10px] text-rose-500">必填</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button disabled={busy} onClick={() => save(false)} className="axon-btn axon-btn-ghost">
                  {busy ? <Loader2 className="animate-spin" size={14} /> : null}
                  儲存
                </button>
                <button disabled={busy} onClick={() => save(true)} className="axon-btn axon-btn-ok">
                  完成點檢
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
