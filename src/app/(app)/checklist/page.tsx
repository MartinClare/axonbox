"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckSquare, Loader2, Play } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/labels";
import { useI18n } from "@/components/I18nProvider";

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
  const { t } = useI18n();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [active, setActive] = useState<Run | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [createdCaseId, setCreatedCaseId] = useState<string | null>(null);

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
    setCreatedCaseId(null);
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
    setNote("");
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
        note,
        complete,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setActive(res.data!);
    setMsg(complete ? t("checklist.doneInspect") : t("common.saved"));
    await load();
  }

  async function inspectResult(result: "PASS" | "FAIL") {
    if (!active) return;
    setBusy(true);
    setCreatedCaseId(null);
    const res = await apiFetch<{
      run: Run;
      case?: { id: string; caseNo: string } | null;
      error?: string;
    }>("/api/checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "inspectResult",
        id: active.id,
        items,
        note,
        result,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setActive(res.data!.run);
    if (result === "PASS") {
      setMsg(t("checklist.passOk"));
    } else if (res.data?.case?.id) {
      setCreatedCaseId(res.data.case.id);
      setMsg(t("checklist.failCase", { caseNo: res.data.case.caseNo }));
    } else {
      setMsg(t("checklist.failOk"));
    }
    await load();
  }

  const doneCount = items.filter((i) => i.checked).length;
  const finished = active && ["DONE", "PASSED", "FAILED"].includes(active.status);

  function statusLabel(status: string) {
    if (status === "PASSED") return t("common.pass");
    if (status === "FAILED") return t("common.fail");
    if (status === "DONE") return t("common.done");
    return t("common.inProgress");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="axon-title text-2xl font-semibold">{t("checklist.title")}</h1>
        <p className="mt-1 text-sm axon-muted">{t("checklist.subtitle")}</p>
        {msg && <p className="mt-1 text-sm text-emerald-700">{msg}</p>}
        {createdCaseId && (
          <Link href={`/cases/${createdCaseId}`} className="mt-1 inline-block text-sm text-[var(--axon-blue)]">
            {t("checklist.goCase")}
          </Link>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t("checklist.templates")}</h2>
          {templates.map((tpl) => {
            const count = JSON.parse(tpl.itemsJson || "[]").length;
            return (
              <div key={tpl.id} className="axon-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-[var(--axon-ink)]">{tpl.name}</div>
                    <p className="mt-1 text-xs text-slate-500">{tpl.description}</p>
                    {tpl.sourceRef && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        {t("checklist.basis", { ref: tpl.sourceRef })}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">{t("checklist.items", { n: count })}</p>
                  </div>
                  <button
                    disabled={busy}
                    onClick={() => start(tpl.id)}
                    className="axon-btn axon-btn-primary shrink-0"
                  >
                    <Play size={14} />
                    {t("checklist.start")}
                  </button>
                </div>
              </div>
            );
          })}
          {!templates.length && (
            <p className="text-sm text-slate-400">{t("checklist.noTemplates")}</p>
          )}

          <h2 className="pt-2 text-sm font-semibold">{t("checklist.recent")}</h2>
          <div className="axon-panel divide-y">
            {runs.map((r) => (
              <button
                key={r.id}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  setActive(r);
                  setItems(JSON.parse(r.itemsJson || "[]"));
                  setNote(r.note || "");
                  setCreatedCaseId(null);
                }}
              >
                <span>
                  {r.title}
                  <span className="ml-2 text-xs text-slate-400">{r.template?.name}</span>
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px]",
                    r.status === "PASSED" || r.status === "DONE"
                      ? "bg-emerald-100 text-emerald-700"
                      : r.status === "FAILED"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-amber-100 text-amber-700",
                  )}
                >
                  {statusLabel(r.status)}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="axon-panel p-5">
          {!active ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center text-sm text-slate-500">
              <CheckSquare className="mb-2 text-slate-300" />
              {t("checklist.pick")}
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
                      disabled={Boolean(finished)}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...item, checked: e.target.checked };
                        setItems(next);
                      }}
                    />
                    <span className="text-sm">
                      {item.text}
                      {item.required && (
                        <span className="ml-1 text-[10px] text-rose-500">{t("common.required")}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
              <textarea
                className="axon-input text-sm"
                rows={2}
                placeholder={t("checklist.notesOpt")}
                value={note}
                disabled={Boolean(finished)}
                onChange={(e) => setNote(e.target.value)}
              />
              {!finished ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <button disabled={busy} onClick={() => save(false)} className="axon-btn axon-btn-ghost">
                    {busy ? <Loader2 className="animate-spin" size={14} /> : null}
                    {t("common.save")}
                  </button>
                  <button disabled={busy} onClick={() => save(true)} className="axon-btn axon-btn-ghost">
                    {t("checklist.completeOnly")}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => inspectResult("PASS")}
                    className="axon-btn axon-btn-ok"
                  >
                    {t("common.pass")}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => inspectResult("FAIL")}
                    className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    {t("common.fail")}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  {t("checklist.ended", { status: active.status })}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
