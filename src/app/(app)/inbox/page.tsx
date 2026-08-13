"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Inbox,
  Mail,
  MessageCircle,
  Loader2,
  Sparkles,
  CheckCircle2,
  Trash2,
  Send,
  ChevronDown,
} from "lucide-react";
import {
  CHANNEL_LABELS,
  INBOX_STATUS_LABELS,
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  cn,
} from "@/lib/labels";
import { apiFetch } from "@/lib/api-client";

type InboxRow = {
  id: string;
  channel: string;
  sender: string;
  subject: string | null;
  body: string;
  status: string;
  aiJson: string | null;
  receivedAt: string;
  case?: { id: string; caseNo: string; title: string; status: string } | null;
};

type ExtractResult = {
  title: string;
  description: string;
  category: string;
  severity: string;
  location: string;
  recommendation: string;
  findings?: Array<{ label: string; detail: string; severity: string }>;
  siteSummary?: string;
  mock?: boolean;
};

const channelIcon = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  WECHAT: MessageCircle,
  MANUAL: Inbox,
} as const;

export default function InboxPage() {
  const router = useRouter();
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [counts, setCounts] = useState({ pending: 0, analyzed: 0, processed: 0, dismissed: 0 });
  const [selected, setSelected] = useState<InboxRow | null>(null);
  const [extract, setExtract] = useState<ExtractResult | null>(null);
  const [filter, setFilter] = useState<string>("PENDING");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showImport, setShowImport] = useState(true);

  const [channel, setChannel] = useState<"EMAIL" | "WHATSAPP" | "WECHAT" | "MANUAL">("EMAIL");
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");

  const load = useCallback(async () => {
    const q = filter ? `?status=${filter}` : "";
    const res = await apiFetch<{
      messages?: InboxRow[];
      counts?: typeof counts;
    }>(`/api/inbox${q}`);
    if (!res.ok) {
      setRows([]);
      return;
    }
    setRows(res.data?.messages || []);
    setCounts(res.data?.counts || { pending: 0, analyzed: 0, processed: 0, dismissed: 0 });
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  function flash(t: string) {
    setMsg(t);
    setTimeout(() => setMsg(""), 2500);
  }

  async function ingest(auto = false) {
    if (!text.trim() && !subject.trim()) return;
    setBusy(true);
    if (auto && channel === "EMAIL") {
      const res = await fetch("/api/workflows/from-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: from || "site@demo.com",
          subject: subject || "現場郵件",
          body: text,
          autoProcess: true,
        }),
      });
      setBusy(false);
      const data = await res.json();
      if (!res.ok) {
        flash(data.error || "工作流失敗");
        return;
      }
      flash(data.message || "已轉事件與任務");
      setText("");
      setSubject("");
      if (data.case?.id) {
        router.push(`/cases/${data.case.id}`);
        return;
      }
      await load();
      return;
    }

    const payload =
      channel === "EMAIL"
        ? { channel, from, subject, body: text }
        : { channel, text, sender: from || undefined };
    const res = await fetch("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) {
      flash("匯入失敗");
      return;
    }
    const data = await res.json();
    setText("");
    setSubject("");
    flash(`已收入 ${data.count} 則訊息`);
    setFilter("PENDING");
    setShowImport(false);
    await load();
  }

  async function selectRow(row: InboxRow) {
    setSelected(row);
    if (row.aiJson) {
      try {
        setExtract(JSON.parse(row.aiJson));
      } catch {
        setExtract(null);
      }
    } else {
      setExtract(null);
    }
  }

  async function analyze() {
    if (!selected) return;
    setBusy(true);
    const res = await fetch(`/api/inbox/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "analyze" }),
    });
    setBusy(false);
    if (!res.ok) {
      flash("分析失敗");
      return;
    }
    const data = await res.json();
    setExtract(data.extract);
    setSelected(data.message);
    flash("AI 分析完成");
    await load();
  }

  async function processToTask() {
    if (!selected) return;
    setBusy(true);
    const res = await fetch(`/api/inbox/${selected.id}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ createTask: true }),
    });
    setBusy(false);
    if (!res.ok) {
      flash("轉事件失敗");
      return;
    }
    const data = await res.json();
    flash("已產生事件與任務");
    if (data.case?.id) {
      router.push(`/cases/${data.case.id}`);
      return;
    }
    await load();
  }

  async function dismiss() {
    if (!selected) return;
    await fetch(`/api/inbox/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dismiss" }),
    });
    setSelected(null);
    setExtract(null);
    flash("已忽略");
    await load();
  }

  const filters = [
    ["待分析", counts.pending, "PENDING"],
    ["已分析", counts.analyzed, "ANALYZED"],
    ["已轉任務", counts.processed, "PROCESSED"],
    ["已忽略", counts.dismissed, "DISMISSED"],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="axon-title text-2xl font-semibold">訊息收件</h1>
          <p className="mt-1 text-sm axon-muted">貼上內容 → AI → 事件／任務</p>
        </div>
        {msg && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">{msg}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filters.map(([label, n, key]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "rounded-full px-3.5 py-2 text-sm transition",
              filter === key
                ? "bg-[var(--axon-ink)] text-white"
                : "bg-white text-slate-600 ring-1 ring-[var(--axon-line)]",
            )}
          >
            {label} {n}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <section className="axon-panel overflow-hidden">
            <button
              type="button"
              onClick={() => setShowImport((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-sm font-semibold text-[var(--axon-ink)]">快速匯入</span>
              <ChevronDown
                size={16}
                className={cn("text-slate-400 transition", showImport && "rotate-180")}
              />
            </button>
            {showImport && (
              <div className="space-y-3 border-t border-[var(--axon-line)] px-4 pb-4 pt-3">
                <div className="flex flex-wrap gap-1 rounded-xl bg-slate-50 p-1">
                  {(["EMAIL", "WHATSAPP", "WECHAT", "MANUAL"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setChannel(c)}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm transition",
                        channel === c
                          ? "bg-[var(--axon-ink)] text-white"
                          : "text-slate-600 hover:bg-white",
                      )}
                    >
                      {CHANNEL_LABELS[c]}
                    </button>
                  ))}
                </div>

                {(channel === "EMAIL" || channel === "MANUAL") && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className="axon-input"
                      placeholder={channel === "EMAIL" ? "寄件人電郵（可選）" : "發送人（可選）"}
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                    <input
                      className="axon-input"
                      placeholder="主旨（可選）"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>
                )}

                <textarea
                  className="axon-input min-h-[110px] resize-y"
                  placeholder={
                    channel === "WHATSAPP"
                      ? "[10:21] 現場主管：B區五樓圍欄未裝"
                      : channel === "WECHAT"
                        ? "張工：洞口未封，有墜落風險"
                        : "貼上郵件正文或現場說明…"
                  }
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />

                <button
                  disabled={busy || (!text.trim() && !subject.trim())}
                  onClick={() => ingest(false)}
                  className="axon-btn axon-btn-primary w-full"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  收入收件箱
                </button>
                {channel === "EMAIL" && (
                  <button
                    disabled={busy || (!text.trim() && !subject.trim())}
                    onClick={() => ingest(true)}
                    className="axon-btn axon-btn-ok w-full"
                  >
                    <Sparkles size={15} />
                    一鍵轉事件＋任務
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="axon-panel overflow-hidden">
            <div className="border-b border-[var(--axon-line)] px-4 py-3 text-sm font-semibold">
              收件列表
            </div>
            <div className="max-h-[460px] divide-y divide-slate-100 overflow-y-auto">
              {rows.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-slate-400">暫無訊息</p>
              )}
              {rows.map((row) => {
                const Icon = channelIcon[row.channel as keyof typeof channelIcon] || Inbox;
                return (
                  <button
                    key={row.id}
                    onClick={() => selectRow(row)}
                    className={cn(
                      "flex w-full gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50",
                      selected?.id === row.id && "bg-slate-50",
                    )}
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[var(--axon-steel)]">
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-[var(--axon-ink)]">
                          {row.subject || row.body.slice(0, 40)}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {INBOX_STATUS_LABELS[row.status] || row.status}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        {CHANNEL_LABELS[row.channel]} · {row.sender}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <section className="axon-panel p-5">
          {!selected ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <Inbox size={22} className="mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">選一則訊息開始處理</p>
              <p className="axon-muted mt-1 text-xs">分析後可一鍵產生事件與任務</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5">
                    {CHANNEL_LABELS[selected.channel]}
                  </span>
                  <span>{selected.sender}</span>
                  <span>{new Date(selected.receivedAt).toLocaleString("zh-HK")}</span>
                </div>
                {selected.subject && (
                  <h2 className="mt-2 text-lg font-semibold text-[var(--axon-ink)]">
                    {selected.subject}
                  </h2>
                )}
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {selected.body}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <button disabled={busy} onClick={analyze} className="axon-btn axon-btn-primary">
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  AI 分析
                </button>
                <button disabled={busy} onClick={processToTask} className="axon-btn axon-btn-ok">
                  <CheckCircle2 size={14} />
                  轉事件
                </button>
                <button disabled={busy} onClick={dismiss} className="axon-btn axon-btn-ghost">
                  <Trash2 size={14} />
                  忽略
                </button>
              </div>

              {selected.case && (
                <button
                  onClick={() => router.push(`/cases/${selected.case!.id}`)}
                  className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-left text-sm text-emerald-800"
                >
                  已關聯事件 {selected.case.caseNo} · {selected.case.title}
                </button>
              )}

              {extract && (
                <div className="space-y-3 rounded-2xl border border-[var(--axon-line)] bg-slate-50/80 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--axon-navy)] px-2.5 py-0.5 text-[11px] text-white">
                      {CATEGORY_LABELS[extract.category] || extract.category}
                    </span>
                    <span className={cn("text-xs font-semibold", SEVERITY_COLORS[extract.severity])}>
                      {SEVERITY_LABELS[extract.severity]} 風險
                    </span>
                  </div>
                  <div className="text-base font-semibold text-[var(--axon-ink)]">{extract.title}</div>
                  <p className="text-sm text-slate-600">
                    {extract.siteSummary || extract.description}
                  </p>
                  <div className="text-xs text-slate-500">位置：{extract.location}</div>
                  <div className="rounded-lg bg-white px-3 py-2.5 text-sm text-slate-700">
                    <span className="text-xs text-slate-400">建議動作</span>
                    <div className="mt-1">{extract.recommendation}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
