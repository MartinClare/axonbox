"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  ImagePlus,
  Loader2,
  ShieldAlert,
  Gauge,
  Wrench,
  CheckCircle2,
  MessageSquare,
  Mic,
  NotebookPen,
  Search,
  X,
  Archive,
} from "lucide-react";
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  cn,
} from "@/lib/labels";
import { isProbablyImage, isBrowserUnsupportedImage } from "@/lib/media";
import { apiFetch } from "@/lib/api-client";

type Finding = {
  type: string;
  label: string;
  detail: string;
  severity: string;
};

type ExtractResult = {
  title: string;
  description: string;
  category: string;
  severity: string;
  location: string;
  recommendation: string;
  progressPct: number;
  workActivity: string;
  findings: Finding[];
  siteSummary: string;
  confidence: number;
  mock: boolean;
  tags?: string[];
  analysisMode?: "record" | "discover";
};

type PersonOpt = { id: string; name: string; role: string };
type CompanyOpt = { id: string; name: string; contact: string | null; trade: string | null };
type AnalysisMode = "record" | "discover";

function normalizeTag(raw: string) {
  return raw.replace(/^#/, "").trim();
}

export default function CapturePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"photo" | "chat" | "voice">("photo");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyMode, setBusyMode] = useState<AnalysisMode | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [people, setPeople] = useState<PersonOpt[]>([]);
  const [companies, setCompanies] = useState<CompanyOpt[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [subcontractorId, setSubcontractorId] = useState("");
  const lastAnalysis = useRef<AnalysisMode>("discover");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setPeople(d.users || []);
        setCompanies(d.subcontractors || []);
      })
      .catch(() => undefined);
    apiFetch<{ tags?: string[] }>("/api/evidence?suggestTags=1").then((res) => {
      if (res.ok) setSuggestedTags(res.data?.tags || []);
    });
  }, []);

  function onFile(f: File | null) {
    setFile(f);
    setResult(null);
    setTags([]);
    setError("");
    if (preview) URL.revokeObjectURL(preview);
    if (!f) {
      setPreview(null);
      return;
    }
    if (isBrowserUnsupportedImage(f)) {
      setPreview(null);
      setError("目前瀏覽器無法預覽 HEIC。請改用 JPG／PNG（手機可先用「最相容」拍照），AI 仍可嘗試分析。");
      return;
    }
    if (isProbablyImage(f)) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  }

  function addTag(raw: string) {
    const t = normalizeTag(raw);
    if (!t) return;
    setTags((prev) => (prev.includes(t) ? prev : [...prev, t].slice(0, 20)));
    setTagDraft("");
  }

  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t));
  }

  async function extract(analysisMode: AnalysisMode) {
    setBusy(true);
    setBusyMode(analysisMode);
    setError("");
    lastAnalysis.current = analysisMode;
    const form = new FormData();
    form.set("text", text);
    form.set("analysisMode", analysisMode);
    if (file) form.set("file", file);
    const res = await fetch("/api/ai/extract", { method: "POST", body: form });
    setBusy(false);
    setBusyMode(null);
    if (!res.ok) {
      setError("分析失敗，請重試");
      return;
    }
    const data = (await res.json()) as ExtractResult;
    setResult(data);
    setTags(Array.isArray(data.tags) ? data.tags.map(normalizeTag).filter(Boolean) : []);
  }

  async function saveEvidenceOnly() {
    if (!file && !text) return;
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("source", mode === "chat" ? "WHATSAPP_IMPORT" : "UPLOAD");
    form.set("title", result?.title || file?.name || "現場記錄");
    form.set("chatText", text);
    form.set("tagsJson", JSON.stringify(tags));
    form.set("skipAi", "1");
    if (result) form.set("aiJson", JSON.stringify({ ...result, tags }));
    if (file) form.set("file", file);
    const evRes = await fetch("/api/evidence", { method: "POST", body: form });
    setBusy(false);
    if (!evRes.ok) {
      setError("儲存證據失敗");
      return;
    }
    setMsg("已存入證據庫");
    setTimeout(() => setMsg(""), 2500);
    apiFetch<{ tags?: string[] }>("/api/evidence?suggestTags=1").then((res) => {
      if (res.ok) setSuggestedTags(res.data?.tags || []);
    });
  }

  async function createCase() {
    if (!result) return;
    setBusy(true);
    let evidenceId: string | undefined;
    const form = new FormData();
    form.set("source", mode === "chat" ? "WHATSAPP_IMPORT" : "UPLOAD");
    form.set("title", result.title);
    form.set("chatText", text);
    form.set("tagsJson", JSON.stringify(tags));
    form.set("skipAi", "1");
    form.set("aiJson", JSON.stringify({ ...result, tags }));
    if (file) form.set("file", file);
    const evRes = await fetch("/api/evidence", { method: "POST", body: form });
    if (evRes.ok) {
      const ev = await evRes.json();
      evidenceId = ev.id;
    }

    const res = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: result.title,
        description: result.description,
        category: result.category,
        severity: result.severity,
        location: result.location,
        recommendation: result.recommendation,
        sourceType: mode === "photo" ? "PHOTO" : mode === "voice" ? "VOICE" : "CHAT",
        evidenceId,
        createTask: true,
        assigneeId: assigneeId || undefined,
        subcontractorId: subcontractorId || undefined,
        dueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError("建立事件失敗");
      return;
    }
    const created = await res.json();
    router.push(`/cases/${created.id}`);
  }

  const isRecord = (result?.analysisMode || lastAnalysis.current) === "record";
  const suggestable = suggestedTags.filter((t) => !tags.includes(t)).slice(0, 8);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--axon-steel)]">
            Site Vision
          </p>
          <h1 className="axon-title mt-1 text-3xl font-semibold">拍一張，看清場地</h1>
          <p className="axon-muted mt-2 max-w-xl text-sm leading-relaxed">
            記錄現況或發現問題：AI 會自動標籤，也可一鍵建立可追蹤事件。
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-[var(--axon-line)] bg-white/80 p-1">
          {(
            [
              ["photo", "照片", Camera],
              ["chat", "訊息", MessageSquare],
              ["voice", "語音", Mic],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition",
                mode === k
                  ? "bg-[var(--axon-navy)] text-white"
                  : "text-slate-600 hover:bg-slate-50",
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="axon-panel overflow-hidden">
          <div className="border-b border-[var(--axon-line)] px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--axon-ink)]">
              {mode === "photo" ? "現場照片" : mode === "chat" ? "訊息匯入" : "語音記錄"}
            </h2>
            <p className="axon-muted mt-0.5 text-xs">
              {mode === "photo"
                ? "支援直接拍攝或從相簿選取 · 記錄現況／發現問題"
                : mode === "chat"
                  ? "可貼上聊天紀錄；正式收件請轉發到場務 WhatsApp 號碼"
                  : "可加說明位置、工序或風險點"}
            </p>
          </div>

          <div className="space-y-4 p-5">
            {mode === "photo" && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="group relative flex min-h-[280px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[var(--axon-steel)]/35 bg-[linear-gradient(160deg,#0c2340_0%,#163a5f_55%,#3d5a80_100%)] text-white transition hover:brightness-110"
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-90"
                  />
                ) : (
                  <>
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur">
                      <ImagePlus size={22} />
                    </div>
                    <div className="text-base font-medium">點擊拍攝或上傳</div>
                    <div className="mt-1 text-xs text-white/70">
                      JPG / PNG / WebP · 建議對準作業面
                    </div>
                  </>
                )}
                {preview && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-left text-xs">
                    點擊更換照片
                  </div>
                )}
              </button>
            )}

            <input
              ref={fileRef}
              type="file"
              accept={mode === "voice" ? "audio/*" : "image/jpeg,image/png,image/webp,image/*"}
              capture={mode === "photo" ? "environment" : undefined}
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] || null)}
            />

            {mode === "voice" && (
              <div className="rounded-2xl border border-[var(--axon-line)] bg-slate-50 px-4 py-8 text-center">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--axon-navy)] px-4 py-2 text-sm text-white"
                >
                  <Mic size={14} />
                  上傳語音
                </button>
                {file && <p className="axon-muted mt-3 text-xs">{file.name}</p>}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                {mode === "chat" ? "WhatsApp / 訊息內容" : "補充說明（可選）"}
              </label>
              <textarea
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3.5 py-3 text-sm outline-none ring-[var(--axon-steel)]/20 focus:ring-2"
                rows={mode === "chat" ? 7 : 3}
                placeholder={
                  mode === "chat"
                    ? "[10:21] 現場主管：B區五樓圍欄未裝"
                    : "例如：B區5樓平台、模板作業"
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            {mode === "photo" ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  disabled={busy || (!file && !text)}
                  onClick={() => extract("record")}
                  className="axon-btn axon-btn-ghost w-full"
                >
                  {busyMode === "record" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <NotebookPen size={16} />
                  )}
                  {busyMode === "record" ? "記錄中…" : "記錄現況"}
                </button>
                <button
                  disabled={busy || (!file && !text)}
                  onClick={() => extract("discover")}
                  className="axon-btn axon-btn-primary w-full"
                >
                  {busyMode === "discover" ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Search size={16} />
                  )}
                  {busyMode === "discover" ? "分析中…" : "發現問題"}
                </button>
              </div>
            ) : (
              <button
                disabled={busy || (!file && !text)}
                onClick={() => extract("discover")}
                className="axon-btn axon-btn-primary w-full"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                {busy ? "AI 分析中…" : "開始分析"}
              </button>
            )}
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {msg && <p className="text-sm text-emerald-700">{msg}</p>}
          </div>
        </section>

        <section className="axon-panel overflow-hidden">
          <div className="border-b border-[var(--axon-line)] px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--axon-ink)]">分析結果</h2>
            <p className="axon-muted mt-0.5 text-xs">
              {isRecord ? "現況摘要 · 標籤 · 可存檔或建事件" : "漏洞 · 進度 · 建議動作"}
            </p>
          </div>

          <div className="p-5">
            {!result ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-[var(--axon-steel)]">
                  <ShieldAlert size={20} />
                </div>
                <p className="text-sm font-medium text-slate-700">上傳照片後，選擇分析方式</p>
                <ul className="axon-muted mt-3 space-y-1 text-xs">
                  <li>· 記錄現況：存檔工序與進度，不硬找缺陷</li>
                  <li>· 發現問題：安全／質量／進度風險</li>
                  <li>· 自動標籤，可自行增刪如 IG</li>
                </ul>
              </div>
            ) : (
              <div className="space-y-5">
                {result.mock && (
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    真實 AI 模式未生效時會顯示此提示。請確認 OpenRouter Key 已設定並重啟服務。
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] text-white",
                        isRecord ? "bg-sky-700" : "bg-[var(--axon-navy)]",
                      )}
                    >
                      {isRecord ? "記錄現況" : "發現問題"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-700">
                      {CATEGORY_LABELS[result.category] || result.category}
                    </span>
                    <span className={cn("text-xs font-semibold", SEVERITY_COLORS[result.severity])}>
                      {SEVERITY_LABELS[result.severity]} 風險
                    </span>
                    <span className="text-xs text-slate-400">
                      置信度 {Math.round((result.confidence || 0) * 100)}%
                    </span>
                  </div>
                  <input
                    className="mt-3 w-full border-0 border-b border-[var(--axon-line)] bg-transparent pb-2 text-lg font-semibold text-[var(--axon-ink)] outline-none"
                    value={result.title}
                    onChange={(e) => setResult({ ...result, title: e.target.value })}
                  />
                  <p className="axon-muted mt-2 text-sm leading-relaxed">
                    {result.siteSummary || result.description}
                  </p>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    標籤
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => removeTag(t)}
                        className="inline-flex items-center gap-1 rounded-full bg-[#e8f4fb] px-2.5 py-1 text-xs font-medium text-[#02445f]"
                        title="移除標籤"
                      >
                        #{t}
                        <X size={11} className="opacity-60" />
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      className="axon-input min-h-0 flex-1 py-2 text-sm"
                      placeholder="新增標籤，按 Enter…"
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag(tagDraft);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="axon-btn axon-btn-ghost min-h-9 px-3 text-xs"
                      onClick={() => addTag(tagDraft)}
                    >
                      加入
                    </button>
                  </div>
                  {suggestable.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {suggestable.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => addTag(t)}
                          className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] text-slate-500 hover:border-[var(--axon-steel)] hover:text-[var(--axon-ink)]"
                        >
                          + {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Gauge size={13} />
                      目視進度
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-[var(--axon-ink)]">
                      {result.progressPct ?? 0}%
                    </div>
                    <div className="axon-progress mt-2">
                      <span style={{ width: `${result.progressPct || 0}%` }} />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Wrench size={13} />
                      主要工序
                    </div>
                    <div className="mt-2 text-sm font-semibold text-[var(--axon-ink)]">
                      {result.workActivity || "—"}
                    </div>
                    <div className="axon-muted mt-2 text-xs">{result.location}</div>
                  </div>
                </div>

                {(!isRecord || (result.findings || []).length > 0) && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {isRecord ? "現況摘要觀察" : "發現的漏洞與問題"}
                    </h3>
                    <div className="space-y-2">
                      {(result.findings || []).length === 0 && (
                        <p className="text-sm text-slate-400">暫未列出具體發現</p>
                      )}
                      {(result.findings || []).map((f, i) => (
                        <div
                          key={i}
                          className="flex gap-3 rounded-xl border border-[var(--axon-line)] px-3 py-2.5"
                        >
                          <div
                            className={cn(
                              "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                              f.severity === "HIGH"
                                ? "bg-rose-500"
                                : f.severity === "MEDIUM"
                                  ? "bg-amber-500"
                                  : "bg-emerald-500",
                            )}
                          />
                          <div>
                            <div className="text-sm font-medium text-[var(--axon-ink)]">
                              {f.label}
                            </div>
                            <div className="axon-muted mt-0.5 text-xs leading-relaxed">
                              {f.detail}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    {isRecord ? "備註" : "建議動作"}
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-[var(--axon-line)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--axon-steel)]/20"
                    rows={2}
                    value={result.recommendation}
                    onChange={(e) =>
                      setResult({ ...result, recommendation: e.target.value })
                    }
                  />
                </div>

                <details className="rounded-xl border border-[var(--axon-line)] bg-slate-50/60 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-600">
                    更多選項（分類／指派）
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        className="axon-input"
                        value={result.category}
                        onChange={(e) => setResult({ ...result, category: e.target.value })}
                      >
                        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <select
                        className="axon-input"
                        value={result.severity}
                        onChange={(e) => setResult({ ...result, severity: e.target.value })}
                      >
                        {Object.entries(SEVERITY_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-500">負責人</span>
                        <select
                          className="axon-input"
                          value={assigneeId}
                          onChange={(e) => setAssigneeId(e.target.value)}
                        >
                          <option value="">預設（當前登入）</option>
                          {people.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-500">分判公司</span>
                        <select
                          className="axon-input"
                          value={subcontractorId}
                          onChange={(e) => setSubcontractorId(e.target.value)}
                        >
                          <option value="">待指派</option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                              {c.trade ? ` · ${c.trade}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                </details>

                <div className="grid gap-2 sm:grid-cols-2">
                  {isRecord && (
                    <button
                      disabled={busy}
                      onClick={saveEvidenceOnly}
                      className="axon-btn axon-btn-ghost w-full"
                    >
                      <Archive size={16} />
                      只存證據
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={createCase}
                    className={cn("axon-btn axon-btn-ok w-full", !isRecord && "sm:col-span-2")}
                  >
                    <CheckCircle2 size={16} />
                    確認並建立事件
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
