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
  Image as ImageIcon,
  FileText,
} from "lucide-react";
import { SEVERITY_COLORS, cn } from "@/lib/labels";
import { apiFetch } from "@/lib/api-client";
import {
  type MinutesOutputLang,
  type MinutesProgress,
  stashMinutesPreview,
  uploadMinutesPreview,
} from "@/lib/file-base64";
import { MinutesProgressOverlay } from "@/components/MinutesProgressOverlay";
import { MinutesUploadGroup } from "@/components/MinutesLangSwitch";
import { useI18n } from "@/components/I18nProvider";
import { FilePreview } from "@/components/FilePreview";
import { resolveInboxActionItems } from "@/lib/inbox-actions";

type InboxFile = {
  name: string;
  mime: string;
  kind: "image" | "audio" | "doc" | "file";
  url?: string;
  dataUrl?: string;
};

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
  updatedAt?: string;
  case?: { id: string; caseNo: string; title: string; status: string } | null;
  fileCount?: number;
  hasImage?: boolean;
  files?: InboxFile[];
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
  actionItems?: Array<{ title: string; detail?: string }>;
};

const channelIcon = {
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  WECHAT: MessageCircle,
  MANUAL: Inbox,
} as const;

const POLL_MS = 3000;

function fileSrc(f: InboxFile, messageId?: string, index?: number) {
  return f.url || f.dataUrl || (messageId != null && index != null ? `/api/inbox/${messageId}/files/${index}` : null);
}

function keepLoadedFiles(prev: InboxRow | null, next: InboxRow): InboxRow {
  if (
    prev?.id === next.id &&
    (prev.fileCount || 0) === (next.fileCount || 0) &&
    prev.body === next.body &&
    prev.files?.length
  ) {
    return {
      ...next,
      files: (next.files || prev.files).map((f, i) => ({
        ...f,
        url: f.url || prev.files?.[i]?.url,
        dataUrl: f.dataUrl || prev.files?.[i]?.dataUrl,
      })),
    };
  }
  return next;
}

export default function InboxPage() {
  const router = useRouter();
  const {
    t,
    channelLabels,
    inboxStatusLabels,
    categoryLabels,
    severityLabels,
  } = useI18n();
  const minutesFileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [counts, setCounts] = useState({ pending: 0, analyzed: 0, processed: 0, dismissed: 0 });
  const [selected, setSelected] = useState<InboxRow | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [splitTasks, setSplitTasks] = useState(true);
  const [extract, setExtract] = useState<ExtractResult | null>(null);
  const [filter, setFilter] = useState<string>("ANALYZED");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [minutesProgress, setMinutesProgress] = useState<MinutesProgress | null>(null);
  const [minutesLang, setMinutesLang] = useState<MinutesOutputLang>("original");
  const [inbound, setInbound] = useState<{
    address: string | null;
    domain?: string | null;
    key?: string | null;
    webhookConfigured: boolean;
    imapConfigured: boolean;
    resendConfigured?: boolean;
    whatsappConfigured?: boolean;
    whatsappNumber?: string | null;
  } | null>(null);

  const [channel, setChannel] = useState<"EMAIL" | "WHATSAPP" | "MANUAL">("EMAIL");
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const knownIdsRef = useRef<Set<string>>(new Set());
  const skipArriveRef = useRef(true);
  const reqIdRef = useRef(0);
  const countsRef = useRef(counts);
  const busyRef = useRef(busy);
  countsRef.current = counts;
  busyRef.current = busy;

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const q = filter ? `?status=${filter}` : "";
    const my = ++reqIdRef.current;
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
        whatsappConfigured?: boolean;
        whatsappNumber?: string | null;
      };
    }>(`/api/inbox${q}`);
    if (my !== reqIdRef.current) return;
    if (!res.ok) {
      if (!opts?.silent) {
        setRows([]);
        setSelected(null);
        setExtract(null);
      }
      return;
    }
    const list = res.data?.messages || [];
    const nextCounts = res.data?.counts || {
      pending: 0,
      analyzed: 0,
      processed: 0,
      dismissed: 0,
    };
    const pendingUp = nextCounts.pending > (countsRef.current.pending || 0);
    const firstPaint = skipArriveRef.current;
    const arrived = list.filter((r) => !knownIdsRef.current.has(r.id));
    knownIdsRef.current = new Set(list.map((r) => r.id));
    skipArriveRef.current = false;

    setRows(list);
    setCounts(nextCounts);
    if (res.data?.inbound) setInbound(res.data.inbound);

    if (!firstPaint && pendingUp && filter === "ANALYZED") {
      setMsg(t("inbox.analyzingNew"));
      window.setTimeout(() => setMsg(""), 2500);
      skipArriveRef.current = true;
      knownIdsRef.current = new Set();
      setFilter("PENDING");
      return;
    }

    let followAnalyzed = false;
    setSelected((prev) => {
      if (prev && !list.some((r) => r.id === prev.id) && filter === "PENDING") {
        followAnalyzed = true;
        return prev;
      }
      if (!firstPaint && arrived.length && !busyRef.current) {
        return keepLoadedFiles(prev, arrived[0]);
      }
      const next = (prev && list.find((r) => r.id === prev.id)) || list[0] || null;
      if (!next) return null;
      return keepLoadedFiles(prev, next);
    });
    if (followAnalyzed) {
      skipArriveRef.current = true;
      knownIdsRef.current = new Set();
      setFilter("ANALYZED");
      return;
    }

    if (!firstPaint && arrived.length) {
      setMsg(t("inbox.newArrived", { n: arrived.length }));
      window.setTimeout(() => setMsg(""), 2500);
    }
  }, [filter, t]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (!cancelled && document.visibilityState === "visible") {
        void load({ silent: true });
      }
    };

    void load();
    timer = setInterval(tick, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [load]);

  useEffect(() => {
    if (!selected) {
      setExtract(null);
      return;
    }
    applyExtract(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.aiJson]);

  useEffect(() => {
    if (!selected) return;
    const n = resolveInboxActionItems(extract, selected.body).length;
    setSplitTasks(n > 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.aiJson]);

  useEffect(() => {
    if (!selected) return;
    const files = selected.files || [];
    if ((selected.fileCount || 0) === 0) return;
    if (files.length >= (selected.fileCount || 0) && files.every((f) => f.url || f.dataUrl)) return;
    let cancelled = false;
    apiFetch<InboxRow>(`/api/inbox/${selected.id}`).then((detail) => {
      if (cancelled || !detail.ok || !detail.data) return;
      setSelected((prev) => (prev?.id === detail.data?.id ? { ...prev, ...detail.data } : prev));
      applyExtract(detail.data);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, selected?.fileCount, selected?.receivedAt]);

  function flash(text: string) {
    setMsg(text);
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
          subject: subject || t("inbox.siteMail"),
          body: text,
          autoProcess: true,
        }),
      });
      setBusy(false);
      const data = await res.json();
      if (!res.ok) {
        flash(data.error || t("inbox.workflowFail"));
        return;
      }
      flash(data.message || t("inbox.approvedTask"));
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
      flash(t("inbox.importFail"));
      return;
    }
    const data = await res.json();
    setText("");
    setSubject("");
    flash(t("inbox.imported", { count: data.count }));
    setFilter("ANALYZED");
    setShowImport(false);
    await load();
  }

  async function selectRow(row: InboxRow) {
    setPreviewIndex(null);
    setSelected(row);
  }

  function applyExtract(row: InboxRow) {
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

  function rowTitle(row: InboxRow) {
    const text = (row.subject || row.body || "").replace(/^\[轉發\]\s*/m, "").trim();
    if (text) return text.slice(0, 40);
    if (row.hasImage) return t("inbox.photo");
    if ((row.fileCount || 0) > 0) return t("inbox.attachment");
    return t("inbox.noText");
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
      flash(t("inbox.analyzeFail"));
      return;
    }
    const data = await res.json();
    setExtract(data.extract);
    setSelected(data.message);
    flash(t("inbox.analyzeOk"));
    await load();
  }

  async function processToTask() {
    if (!selected) return;
    const points = resolveInboxActionItems(extract, selected.body);
    setBusy(true);
    const res = await fetch(`/api/inbox/${selected.id}/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        createTask: true,
        splitTasks: splitTasks && points.length > 1,
        actionItems: points,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      flash(t("inbox.toCaseFail"));
      return;
    }
    const data = await res.json();
    flash(t("inbox.approvedCase"));
    skipArriveRef.current = true;
    knownIdsRef.current = new Set();
    setFilter("PROCESSED");
    if (!data.case?.id) await load();
  }

  async function undoApprove() {
    if (!selected) return;
    setBusy(true);
    const res = await fetch(`/api/inbox/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "undoProcess" }),
    });
    setBusy(false);
    if (!res.ok) {
      flash(t("inbox.undoFail"));
      return;
    }
    flash(t("inbox.undone"));
    skipArriveRef.current = true;
    knownIdsRef.current = new Set();
    setFilter("ANALYZED");
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
    flash(t("inbox.dismissed"));
    await load();
  }

  function setFilterTab(key: string) {
    skipArriveRef.current = true;
    knownIdsRef.current = new Set();
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
      flash(res.error || t("inbox.restoreFail"));
      return;
    }
    clearSelectionIfGone(ids);
    flash(t("inbox.restored", { n: res.data?.restored || ids.length }));
    await load();
  }

  async function bulkDelete(ids: string[]) {
    if (ids.length === 0) return;
    if (!window.confirm(t("inbox.purgeConfirm", { n: ids.length }))) return;
    setBusy(true);
    const res = await apiFetch<{ deleted?: number }>("/api/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ids }),
    });
    setBusy(false);
    if (!res.ok) {
      flash(res.error || t("inbox.deleteFail"));
      return;
    }
    clearSelectionIfGone(ids);
    flash(t("inbox.deleted", { n: res.data?.deleted || ids.length }));
    await load();
  }

  async function copyAddress() {
    if (!inbound?.address) return;
    await navigator.clipboard.writeText(inbound.address);
    flash(t("inbox.copiedEmail"));
  }

  async function syncMail() {
    setBusy(true);
    const res = await fetch("/api/connectors/email/sync", { method: "POST" });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      flash(data.error || t("inbox.fetchFail"));
      return;
    }
    flash(t("inbox.fetched", { pulled: data.pulled || 0, proposed: data.proposed || 0 }));
    setFilter("ANALYZED");
    await load();
  }

  async function onPickMinutes(file: File | null) {
    if (!file) return;
    setBusy(true);
    setMinutesProgress({ pct: 4, label: t("inbox.startProcess") });
    try {
      const data = await uploadMinutesPreview(file, setMinutesProgress, {
        outputLang: minutesLang,
      });
      setMinutesProgress({ pct: 100, label: t("inbox.gotoAnalyze") });
      await new Promise((r) => setTimeout(r, 280));
      stashMinutesPreview({
        title: data.title,
        meetingAt: data.meetingAt,
        sourceName: data.sourceName,
        rawText: data.rawText,
        actions: data.actions || [],
        outputLang: data.outputLang || minutesLang,
        mock: data.mock,
      });
      router.push("/tasks?minutesPreview=1");
    } catch (err) {
      flash(err instanceof Error ? err.message : t("inbox.minutesFail"));
    } finally {
      setBusy(false);
      setMinutesProgress(null);
    }
  }

  const filters = [
    [t("inbox.pendingApprove"), counts.analyzed, "ANALYZED"],
    [t("inbox.pendingAnalyze"), counts.pending, "PENDING"],
    [t("inbox.taskCreated"), counts.processed, "PROCESSED"],
    [t("inbox.dismissed"), counts.dismissed, "DISMISSED"],
  ] as const;

  const actionPoints = selected ? resolveInboxActionItems(extract, selected.body) : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="axon-title text-2xl font-semibold">{t("inbox.title")}</h1>
          <p className="mt-1 text-sm axon-muted">
            {t("inbox.subtitle")}
          </p>
        </div>
        {msg && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">{msg}</span>
        )}
      </div>

      <section className="axon-panel space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--axon-ink)]">{t("inbox.forwardTitle")}</div>
            <p className="mt-1 text-xs text-slate-500">
              {t("inbox.forwardHint")}
            </p>
          </div>
          {(inbound?.imapConfigured || inbound?.resendConfigured) && (
            <button disabled={busy} onClick={syncMail} className="axon-btn axon-btn-ghost">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {t("inbox.fetchMail")}
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
              {t("common.copy")}
            </button>
          </div>
        ) : (
          <p className="text-sm text-amber-700">{t("inbox.forwardEmpty")}</p>
        )}
      </section>

      <section className="axon-panel space-y-3 p-5">
        <div>
          <div className="text-sm font-semibold text-[var(--axon-ink)]">{t("inbox.waTitle")}</div>
          <p className="mt-1 text-xs text-slate-500">
            {t("inbox.waHint")}
          </p>
        </div>
        <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-[var(--axon-ink)]">
          {t("inbox.waAskCs")}
        </p>
        <p className="text-xs text-slate-500">
          {t("inbox.waCsContact")}{" "}
          <a className="text-[var(--axon-blue)] hover:underline" href="mailto:info@axon.com.hk">
            info@axon.com.hk
          </a>
        </p>
      </section>

      <div className="flex flex-wrap gap-1.5">
        {filters.map(([label, n, key]) => (
          <button
            key={key}
            onClick={() => setFilterTab(key)}
            className={cn(
              "rounded-full px-3.5 py-2 text-sm transition",
              filter === key
                ? "bg-[var(--axon-brand)] text-white"
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
              <span className="text-sm font-semibold text-[var(--axon-ink)]">{t("inbox.quickImport")}</span>
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
                          ? "bg-[var(--axon-brand)] text-white"
                          : "text-slate-600 hover:bg-white",
                      )}
                    >
                      {channelLabels[c]}
                    </button>
                  ))}
                </div>

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
                <MinutesUploadGroup
                  value={minutesLang}
                  onChange={setMinutesLang}
                  disabled={busy}
                  className="w-full sm:w-auto"
                >
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => minutesFileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-violet-900 ring-1 ring-violet-200 transition hover:bg-violet-50 disabled:opacity-50"
                    title={t("inbox.minutesHint")}
                  >
                    <FileUp size={14} />
                    {busy && minutesProgress ? t("common.processing") : t("inbox.uploadFile")}
                  </button>
                </MinutesUploadGroup>

                {(channel === "EMAIL" || channel === "MANUAL") && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      className="axon-input"
                      placeholder={channel === "EMAIL" ? t("inbox.senderEmail") : t("inbox.senderName")}
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                    <input
                      className="axon-input"
                      placeholder={t("inbox.subject")}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>
                )}

                <textarea
                  className="axon-input min-h-[110px] resize-y"
                  placeholder={
                    channel === "WHATSAPP"
                      ? t("capture.chatPh")
                      : t("inbox.pastePh")
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
                  {t("inbox.ingest")}
                </button>
                {channel === "EMAIL" && (
                  <button
                    disabled={busy || (!text.trim() && !subject.trim())}
                    onClick={() => ingest(true)}
                    className="axon-btn axon-btn-ok w-full"
                  >
                    <Sparkles size={15} />
                    {t("inbox.skipApprove")}
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="axon-panel overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--axon-line)] px-4 py-3">
              <div className="text-sm font-semibold">{t("inbox.list")}</div>
              {filter === "DISMISSED" && rows.length > 0 && (
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && rows.every((r) => checked.has(r.id))}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                  {t("common.selectAll")}
                </label>
              )}
            </div>
            {filter === "DISMISSED" && checked.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-[var(--axon-line)] bg-slate-50/80 px-4 py-2.5">
                <span className="mr-auto text-xs text-slate-500">{t("inbox.selected", { n: checked.size })}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => bulkRestore([...checked])}
                  className="axon-btn axon-btn-ghost min-h-9 px-3 py-1.5 text-xs"
                >
                  <Undo2 size={13} />
                  {t("inbox.restore")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => bulkDelete([...checked])}
                  className="axon-btn axon-btn-ghost min-h-9 px-3 py-1.5 text-xs text-rose-700"
                >
                  <Trash2 size={13} />
                  {t("common.delete")}
                </button>
              </div>
            )}
            <div className="max-h-[460px] divide-y divide-slate-100 overflow-y-auto">
              {rows.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-slate-400">{t("inbox.empty")}</p>
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
                            {rowTitle(row)}
                          </span>
                          {row.hasImage && (
                            <ImageIcon size={12} className="shrink-0 text-slate-400" />
                          )}
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {inboxStatusLabels[row.status] || row.status}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">
                          {channelLabels[row.channel]}
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
                {filter === "DISMISSED" ? t("inbox.pickDismissed") : t("inbox.pickAnalyzed")}
              </p>
              <p className="axon-muted mt-1 text-xs">
                {filter === "DISMISSED" ? t("inbox.dismissedHint") : t("inbox.approveHint")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {t("inbox.original")}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5">
                    {channelLabels[selected.channel]}
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
                {selected.body.trim() ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {selected.body}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">{t("inbox.noText")}</p>
                )}
                {(selected.files || []).length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {selected.files?.map((f, idx) => {
                        if (f.kind !== "image") return null;
                        const src = fileSrc(f, selected.id, idx);
                        if (!src) return null;
                        return (
                          <a
                            key={`${f.name}-${idx}`}
                            href={src}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => {
                              if (e.metaKey || e.ctrlKey) return;
                              e.preventDefault();
                              setPreviewIndex(idx);
                            }}
                            className="overflow-hidden rounded-xl ring-1 ring-[var(--axon-line)] hover:ring-[var(--axon-blue)]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt={f.name} className="h-40 w-full object-cover" />
                            <div className="truncate px-2 py-1 text-[11px] text-slate-500">{f.name}</div>
                          </a>
                        );
                      })}
                    </div>
                    {selected.files?.map((f, idx) => {
                      if (f.kind === "image") return null;
                      const src = fileSrc(f, selected.id, idx);
                      if (!src) return null;
                      return (
                        <a
                          key={`${f.name}-${idx}`}
                          href={src}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            if (e.metaKey || e.ctrlKey) return;
                            e.preventDefault();
                            setPreviewIndex(idx);
                          }}
                          className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-[var(--axon-blue)] ring-1 ring-transparent hover:bg-sky-50 hover:ring-sky-200"
                        >
                          <FileText size={16} className="shrink-0 text-slate-500" />
                          <span className="min-w-0 flex-1 truncate underline decoration-slate-300 underline-offset-2">
                            {f.name}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                )}
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
                      {t("inbox.restore")}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => bulkDelete([selected.id])}
                      className="axon-btn axon-btn-ghost text-rose-700 sm:col-span-2"
                    >
                      <Trash2 size={14} />
                      {t("inbox.purge")}
                    </button>
                  </>
                ) : (
                  <>
                    <button disabled={busy} onClick={analyze} className="axon-btn axon-btn-primary">
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                      {t("inbox.analyze")}
                    </button>
                    {selected.status === "PROCESSED" ? (
                      <button disabled={busy} onClick={undoApprove} className="axon-btn axon-btn-ghost">
                        <Undo2 size={14} />
                        {t("inbox.undoApprove")}
                      </button>
                    ) : (
                      <button disabled={busy} onClick={processToTask} className="axon-btn axon-btn-ok">
                        <CheckCircle2 size={14} />
                        {splitTasks && actionPoints.length > 1
                          ? t("inbox.approveSplit", { n: actionPoints.length })
                          : t("inbox.approve")}
                      </button>
                    )}
                    <button disabled={busy} onClick={dismiss} className="axon-btn axon-btn-ghost">
                      <Trash2 size={14} />
                      {t("inbox.dismiss")}
                    </button>
                  </>
                )}
              </div>

              {selected.case && (
                <button
                  onClick={() => router.push(`/cases/${selected.case!.id}`)}
                  className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-left text-sm text-emerald-800"
                >
                  {t("inbox.linkedCase", { caseNo: selected.case.caseNo, title: selected.case.title })}
                </button>
              )}

              {extract && (
                <div className="space-y-3 rounded-2xl border border-[var(--axon-line)] bg-slate-50/80 p-4">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    {t("inbox.proposal")}
                    {extract.mock ? ` · ${t("inbox.mock")}` : ""}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--axon-brand)] px-2.5 py-0.5 text-[11px] text-white">
                      {categoryLabels[extract.category] || extract.category}
                    </span>
                    <span className={cn("text-xs font-semibold", SEVERITY_COLORS[extract.severity])}>
                      {severityLabels[extract.severity]}
                    </span>
                  </div>
                  <div className="text-base font-semibold text-[var(--axon-ink)]">{extract.title}</div>
                  <p className="text-sm text-slate-600">
                    {extract.siteSummary || extract.description}
                  </p>
                  <div className="text-xs text-slate-500">{t("inbox.location", { loc: extract.location })}</div>
                  {actionPoints.length > 0 && (
                    <div className="rounded-lg bg-white px-3 py-2.5">
                      <div className="text-xs text-slate-400">{t("inbox.mainPoints")}</div>
                      <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm text-slate-700">
                        {actionPoints.map((item, i) => (
                          <li key={`${item.title}-${i}`}>
                            {item.title}
                            {item.detail ? (
                              <div className="text-xs text-slate-500">{item.detail}</div>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                      {selected.status !== "PROCESSED" && actionPoints.length > 1 && (
                          <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={splitTasks}
                              onChange={(e) => setSplitTasks(e.target.checked)}
                            />
                            <span>
                              <span className="font-medium">{t("inbox.splitTasks")}</span>
                              <span className="mt-0.5 block text-xs text-slate-400">
                                {splitTasks ? t("inbox.splitHint") : t("inbox.keepTogether")}
                              </span>
                            </span>
                          </label>
                        )}
                    </div>
                  )}
                  <div className="rounded-lg bg-white px-3 py-2.5 text-sm text-slate-700">
                    <span className="text-xs text-slate-400">{t("inbox.suggestedActions")}</span>
                    <div className="mt-1">{extract.recommendation}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {minutesProgress && <MinutesProgressOverlay progress={minutesProgress} />}

      {previewIndex != null && selected?.files?.[previewIndex] && (
        <FilePreview
          items={(selected.files || []).map((f, idx) => ({
            name: f.name,
            src: fileSrc(f, selected.id, idx),
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
