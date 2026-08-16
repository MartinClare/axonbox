"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  Copy,
  RefreshCw,
  Undo2,
  FileUp,
  X,
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
  mailbox?: string | null;
  forwardedByName?: string | null;
  fromEmail?: string | null;
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

type PreviewAction = {
  title: string;
  assigneeName: string | null;
  assigneeId: string | null;
  dueAt: string | null;
  notes: string | null;
};

type MinutesPreview = {
  title: string;
  meetingAt: string | null;
  sourceName: string;
  rawText: string;
  actions: PreviewAction[];
  mock?: boolean;
};

type UserOpt = { id: string; name: string };

const channelIcon = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  WECHAT: MessageCircle,
  MANUAL: Inbox,
} as const;

export default function InboxPage() {
  const router = useRouter();
  const minutesFileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [counts, setCounts] = useState({ pending: 0, analyzed: 0, processed: 0, dismissed: 0 });
  const [selected, setSelected] = useState<InboxRow | null>(null);
  const [extract, setExtract] = useState<ExtractResult | null>(null);
  const [filter, setFilter] = useState<string>("ANALYZED");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [minutesPreview, setMinutesPreview] = useState<MinutesPreview | null>(null);
  const [minutesUsers, setMinutesUsers] = useState<UserOpt[]>([]);
  const [confirmingMinutes, setConfirmingMinutes] = useState(false);
  const [inbound, setInbound] = useState<{
    address: string | null;
    domain?: string | null;
    key?: string | null;
    webhookConfigured: boolean;
    imapConfigured: boolean;
    resendConfigured?: boolean;
  } | null>(null);

  const [channel, setChannel] = useState<"EMAIL" | "WHATSAPP" | "MANUAL">("EMAIL");
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");

  const load = useCallback(async () => {
    const q = filter ? `?status=${filter}` : "";
    const res = await apiFetch<{
      messages?: InboxRow[];
      counts?: typeof counts;
      inbound?: {
        address: string | null;
        domain?: string | null;
        key?: string | null;
        webhookConfigured: boolean;
        imapConfigured: boolean;
        resendConfigured?: boolean;
      };
    }>(`/api/inbox${q}`);
    if (!res.ok) {
      setRows([]);
      return;
    }
    setRows(res.data?.messages || []);
    setCounts(res.data?.counts || { pending: 0, analyzed: 0, processed: 0, dismissed: 0 });
    if (res.data?.inbound) setInbound(res.data.inbound);
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
      flash(data.message || "已核准並建立任務");
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
    flash(`已收入並產生建議個案 ${data.count} 則`);
    setFilter("ANALYZED");
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
    flash("已核准：已建立事件與跟進任務");
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

  function setFilterTab(key: string) {
    setFilter(key);
    setChecked(new Set());
  }

  function toggleChecked(id: string, on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(on: boolean) {
    setChecked(on ? new Set(rows.map((r) => r.id)) : new Set());
  }

  function clearSelectionIfGone(ids: string[]) {
    const gone = new Set(ids);
    if (selected && gone.has(selected.id)) {
      setSelected(null);
      setExtract(null);
    }
    setChecked((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }

  async function bulkRestore(ids: string[]) {
    if (ids.length === 0) return;
    setBusy(true);
    const res = await apiFetch<{ restored?: number }>("/api/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore", ids }),
    });
    setBusy(false);
    if (!res.ok) {
      flash(res.error || "恢復失敗");
      return;
    }
    clearSelectionIfGone(ids);
    flash(`已恢復 ${res.data?.restored || ids.length} 則`);
    await load();
  }

  async function bulkDelete(ids: string[]) {
    if (ids.length === 0) return;
    if (!window.confirm(`確定永久刪除 ${ids.length} 則已忽略訊息？此操作無法復原。`)) return;
    setBusy(true);
    const res = await apiFetch<{ deleted?: number }>("/api/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ids }),
    });
    setBusy(false);
    if (!res.ok) {
      flash(res.error || "刪除失敗");
      return;
    }
    clearSelectionIfGone(ids);
    flash(`已刪除 ${res.data?.deleted || ids.length} 則`);
    await load();
  }

  async function copyAddress() {
    if (!inbound?.address) return;
    await navigator.clipboard.writeText(inbound.address);
    flash("已複製，請貼到郵件 To");
  }

  async function syncMail() {
    setBusy(true);
    const res = await fetch("/api/connectors/email/sync", { method: "POST" });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      flash(data.error || "收取失敗");
      return;
    }
    flash(`已收取 ${data.pulled || 0} 封，建議個案 ${data.proposed || 0} 則`);
    setFilter("ANALYZED");
    await load();
  }

  async function onPickMinutes(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const { fileToBase64 } = await import("@/lib/file-base64");
      const fileBase64 = await fileToBase64(file);
      const [uploadRes, settingsRes] = await Promise.all([
        apiFetch<MinutesPreview>("/api/meetings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preview: true,
            fileName: file.name,
            mime: file.type || "",
            fileBase64,
          }),
        }),
        apiFetch<{ users?: UserOpt[] }>("/api/settings"),
      ]);
      setBusy(false);
      if (!uploadRes.ok) {
        flash(uploadRes.error || "會議紀錄上傳失敗");
        return;
      }
      if (!uploadRes.data) {
        flash("會議紀錄上傳失敗");
        return;
      }
      if (settingsRes.ok) setMinutesUsers(settingsRes.data?.users || []);
      setMinutesPreview({
        title: uploadRes.data.title,
        meetingAt: uploadRes.data.meetingAt,
        sourceName: uploadRes.data.sourceName,
        rawText: uploadRes.data.rawText,
        actions: uploadRes.data.actions || [],
        mock: uploadRes.data.mock,
      });
    } catch (err) {
      setBusy(false);
      flash(err instanceof Error ? err.message : "會議紀錄上傳失敗");
    }
  }

  async function confirmMinutes() {
    if (!minutesPreview || minutesPreview.actions.length === 0) return;
    setConfirmingMinutes(true);
    const res = await apiFetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm: true,
        title: minutesPreview.title,
        meetingAt: minutesPreview.meetingAt,
        sourceName: minutesPreview.sourceName,
        rawText: minutesPreview.rawText,
        actions: minutesPreview.actions,
      }),
    });
    setConfirmingMinutes(false);
    if (!res.ok) {
      flash(res.error || "建立會議列表失敗");
      return;
    }
    setMinutesPreview(null);
    flash("已建立會議任務列表");
    router.push("/tasks");
  }

  const filters = [
    ["待核准", counts.analyzed, "ANALYZED"],
    ["待分析", counts.pending, "PENDING"],
    ["已建任務", counts.processed, "PROCESSED"],
    ["已忽略", counts.dismissed, "DISMISSED"],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="axon-title text-2xl font-semibold">訊息收件</h1>
          <p className="mt-1 text-sm axon-muted">
            轉寄郵件到專用信箱 → AI 建議個案 → 核准後建立任務
          </p>
        </div>
        {msg && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">{msg}</span>
        )}
      </div>

      <section className="axon-panel space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--axon-ink)]">你的轉寄地址</div>
            <p className="mt-1 text-xs text-slate-500">
              把這組地址貼到郵件的 To。@ 前是你的保密代號，不要外傳或改用容易猜的名稱。
            </p>
          </div>
          {(inbound?.imapConfigured || inbound?.resendConfigured) && (
            <button disabled={busy} onClick={syncMail} className="axon-btn axon-btn-ghost">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              收取新郵件
            </button>
          )}
        </div>
        {inbound?.address ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-[var(--axon-ink)]">
              {inbound.address}
            </code>
            <button type="button" onClick={copyAddress} className="axon-btn axon-btn-ghost">
              <Copy size={14} />
              複製
            </button>
          </div>
        ) : (
          <p className="text-sm text-amber-700">尚未設定轉寄信箱。請到人員名冊確認你的專屬代號。</p>
        )}
      </section>

      <div className="flex flex-wrap gap-1.5">
        {filters.map(([label, n, key]) => (
          <button
            key={key}
            onClick={() => setFilterTab(key)}
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
                  {(["EMAIL", "WHATSAPP", "MANUAL"] as const).map((c) => (
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
                  <input
                    ref={minutesFileRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      e.target.value = "";
                      onPickMinutes(f);
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => minutesFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-purple-800 transition hover:bg-white"
                    title="上傳會議紀錄，行動項目會放到任務看板的獨立列表"
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <FileUp size={14} />}
                    會議紀錄
                  </button>
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
                    略過核准，直接建任務
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="axon-panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--axon-line)] px-4 py-3">
              <div className="text-sm font-semibold">收件列表</div>
              {filter === "DISMISSED" && rows.length > 0 && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && rows.every((r) => checked.has(r.id))}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                  全選
                </label>
              )}
            </div>
            {filter === "DISMISSED" && checked.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--axon-line)] bg-slate-50/80 px-4 py-2.5">
                <span className="mr-auto text-xs text-slate-500">已選 {checked.size} 則</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => bulkRestore([...checked])}
                  className="axon-btn axon-btn-ghost min-h-9 px-3 py-1.5 text-xs"
                >
                  <Undo2 size={13} />
                  恢復
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => bulkDelete([...checked])}
                  className="axon-btn axon-btn-ghost min-h-9 px-3 py-1.5 text-xs text-rose-700"
                >
                  <Trash2 size={13} />
                  刪除
                </button>
              </div>
            )}
            <div className="max-h-[460px] divide-y divide-slate-100 overflow-y-auto">
              {rows.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-slate-400">暫無訊息</p>
              )}
              {rows.map((row) => {
                const Icon = channelIcon[row.channel as keyof typeof channelIcon] || Inbox;
                return (
                  <div
                    key={row.id}
                    className={cn(
                      "flex items-stretch transition hover:bg-slate-50",
                      selected?.id === row.id && "bg-slate-50",
                    )}
                  >
                    {filter === "DISMISSED" && (
                      <label
                        className="flex cursor-pointer items-center px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={checked.has(row.id)}
                          onChange={(e) => toggleChecked(row.id, e.target.checked)}
                        />
                      </label>
                    )}
                    <button
                      onClick={() => selectRow(row)}
                      className="flex min-w-0 flex-1 gap-3 py-3.5 pr-4 text-left"
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
                          {CHANNEL_LABELS[row.channel]}
                          {row.forwardedByName || row.mailbox
                            ? ` · ${row.forwardedByName || row.mailbox}`
                            : ""}{" "}
                          · {row.fromEmail || row.sender}
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="axon-panel p-5">
          {!selected ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
              <Inbox size={22} className="mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">
                {filter === "DISMISSED" ? "選一則已忽略訊息，或勾選後批量處理" : "選一則建議個案開始核准"}
              </p>
              <p className="axon-muted mt-1 text-xs">
                {filter === "DISMISSED" ? "可恢復回待核准，或永久刪除" : "核准後會建立事件與跟進任務"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5">
                    {CHANNEL_LABELS[selected.channel]}
                  </span>
                  {(selected.forwardedByName || selected.mailbox) && (
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-blue-700">
                      {selected.forwardedByName || selected.mailbox}
                      {selected.mailbox ? ` · ${selected.mailbox}` : ""}
                    </span>
                  )}
                  <span>{selected.fromEmail || selected.sender}</span>
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
                {selected.status === "DISMISSED" ? (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => bulkRestore([selected.id])}
                      className="axon-btn axon-btn-primary"
                    >
                      <Undo2 size={14} />
                      恢復
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => bulkDelete([selected.id])}
                      className="axon-btn axon-btn-ghost text-rose-700 sm:col-span-2"
                    >
                      <Trash2 size={14} />
                      永久刪除
                    </button>
                  </>
                ) : (
                  <>
                    <button disabled={busy} onClick={analyze} className="axon-btn axon-btn-primary">
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      AI 分析
                    </button>
                    <button disabled={busy} onClick={processToTask} className="axon-btn axon-btn-ok">
                      <CheckCircle2 size={14} />
                      核准並建立任務
                    </button>
                    <button disabled={busy} onClick={dismiss} className="axon-btn axon-btn-ghost">
                      <Trash2 size={14} />
                      忽略
                    </button>
                  </>
                )}
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

      {minutesPreview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-start sm:pt-10">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--axon-ink)]">確認會議行動項目</h2>
                <p className="mt-1 text-xs text-slate-500">
                  來自 {minutesPreview.sourceName}
                  {minutesPreview.mock ? " · Mock 分析" : ""}
                  。確認後會在任務看板右側新增獨立列表。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMinutesPreview(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-slate-500">
                列表名稱
                <input
                  className="axon-input mt-1 min-h-0 py-2 text-sm"
                  value={minutesPreview.title}
                  onChange={(e) =>
                    setMinutesPreview({ ...minutesPreview, title: e.target.value })
                  }
                />
              </label>
              <label className="text-xs text-slate-500">
                會議日期
                <input
                  type="date"
                  className="axon-input mt-1 min-h-0 py-2 text-sm"
                  value={minutesPreview.meetingAt || ""}
                  onChange={(e) =>
                    setMinutesPreview({
                      ...minutesPreview,
                      meetingAt: e.target.value || null,
                    })
                  }
                />
              </label>
            </div>

            <div className="space-y-2">
              {minutesPreview.actions.map((a, idx) => (
                <div
                  key={idx}
                  className="grid gap-2 rounded-xl border border-[var(--axon-line)] bg-slate-50/80 p-3 sm:grid-cols-[1fr_140px_120px_auto]"
                >
                  <input
                    className="axon-input min-h-0 py-2 text-sm"
                    value={a.title}
                    onChange={(e) => {
                      const actions = minutesPreview.actions.map((row, i) =>
                        i === idx ? { ...row, title: e.target.value } : row,
                      );
                      setMinutesPreview({ ...minutesPreview, actions });
                    }}
                    placeholder="行動項目"
                  />
                  <select
                    className="axon-input min-h-0 py-2 text-xs"
                    value={a.assigneeId || ""}
                    onChange={(e) => {
                      const actions = minutesPreview.actions.map((row, i) =>
                        i === idx
                          ? {
                              ...row,
                              assigneeId: e.target.value || null,
                              assigneeName:
                                minutesUsers.find((u) => u.id === e.target.value)?.name ||
                                row.assigneeName,
                            }
                          : row,
                      );
                      setMinutesPreview({ ...minutesPreview, actions });
                    }}
                  >
                    <option value="">
                      {a.assigneeName ? `未對應：${a.assigneeName}` : "未指派"}
                    </option>
                    {minutesUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    className="axon-input min-h-0 py-2 text-xs"
                    value={a.dueAt || ""}
                    onChange={(e) => {
                      const actions = minutesPreview.actions.map((row, i) =>
                        i === idx ? { ...row, dueAt: e.target.value || null } : row,
                      );
                      setMinutesPreview({ ...minutesPreview, actions });
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-lg px-2 text-rose-600 hover:bg-rose-50"
                    onClick={() =>
                      setMinutesPreview({
                        ...minutesPreview,
                        actions: minutesPreview.actions.filter((_, i) => i !== idx),
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {minutesPreview.actions.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">沒有行動項目</p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setMinutesPreview(null)}
                className="axon-btn axon-btn-ghost min-h-9 px-4 text-sm"
              >
                取消
              </button>
              <button
                type="button"
                disabled={confirmingMinutes || minutesPreview.actions.length === 0}
                onClick={confirmMinutes}
                className="axon-btn axon-btn-primary min-h-9 px-4 text-sm"
              >
                {confirmingMinutes
                  ? "建立中…"
                  : `建立列表（${minutesPreview.actions.length}）`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
