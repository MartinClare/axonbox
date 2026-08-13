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
} from "lucide-react";
import {
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  cn,
} from "@/lib/labels";
import { isProbablyImage, isBrowserUnsupportedImage } from "@/lib/media";

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
};

type PersonOpt = { id: string; name: string; role: string };
type CompanyOpt = { id: string; name: string; contact: string | null; trade: string | null };

export default function CapturePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"photo" | "chat" | "voice">("photo");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [people, setPeople] = useState<PersonOpt[]>([]);
  const [companies, setCompanies] = useState<CompanyOpt[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [subcontractorId, setSubcontractorId] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        setPeople(d.users || []);
        setCompanies(d.subcontractors || []);
      })
      .catch(() => undefined);
  }, []);

  function onFile(f: File | null) {
    setFile(f);
    setResult(null);
    setError("");
    if (preview) URL.revokeObjectURL(preview);
    if (!f) {
      setPreview(null);
      return;
    }
    if (isBrowserUnsupportedImage(f)) {
      setPreview(null);
      setError("目前瀏覽器無法預覽 HEIC。請改用 JPG／PNG（手機可先用「最相容」拍照），AI 仍可嘗試分析。");
      // still keep file for AI if OpenRouter accepts it
      return;
    }
    if (isProbablyImage(f)) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  }

  async function extract() {
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("text", text);
    if (file) form.set("file", file);
    const res = await fetch("/api/ai/extract", { method: "POST", body: form });
    setBusy(false);
    if (!res.ok) {
      setError("\u5206\u6790\u5931\u6557\uff0c\u8acb\u91cd\u8a66");
      return;
    }
    setResult(await res.json());
  }

  async function createCase() {
    if (!result) return;
    setBusy(true);
    let evidenceId: string | undefined;
    const form = new FormData();
    form.set("source", mode === "chat" ? "WHATSAPP_IMPORT" : "UPLOAD");
    form.set("title", result.title);
    form.set("chatText", text);
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
      setError("\u5efa\u7acb\u4e8b\u4ef6\u5931\u6557");
      return;
    }
    const created = await res.json();
    router.push(`/cases/${created.id}`);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--axon-steel)]">
            Site Vision
          </p>
          <h1 className="axon-title mt-1 text-3xl font-semibold">
            {"\u62cd\u4e00\u5f35\uff0c\u770b\u6e05\u5834\u5730"}
          </h1>
          <p className="axon-muted mt-2 max-w-xl text-sm leading-relaxed">
            {"AI \u8b58\u5225\u5b89\u5168\u6f0f\u6d1e\u3001\u8cea\u91cf\u554f\u984c\u8207\u9032\u5ea6\u7d04\u6578\uff0c\u4e00\u9375\u8f49\u6210\u53ef\u8ffd\u8e64\u4e8b\u4ef6\u3002"}
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-[var(--axon-line)] bg-white/80 p-1">
          {(
            [
              ["photo", "\u7167\u7247", Camera],
              ["chat", "\u8a0a\u606f", MessageSquare],
              ["voice", "\u8a9e\u97f3", Mic],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition",
                mode === k
                  ? "bg-[var(--axon-navy)] text-white"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        {/* Left: capture */}
        <section className="axon-panel overflow-hidden">
          <div className="border-b border-[var(--axon-line)] px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--axon-ink)]">
              {mode === "photo"
                ? "\u73fe\u5834\u7167\u7247"
                : mode === "chat"
                  ? "\u8a0a\u606f\u532f\u5165"
                  : "\u8a9e\u97f3\u8a18\u9304"}
            </h2>
            <p className="axon-muted mt-0.5 text-xs">
              {mode === "photo"
                ? "\u652f\u6301\u76f4\u63a5\u62cd\u651d\u6216\u5f9e\u76f8\u7c3f\u9078\u53d6"
                : "\u53ef\u52a0\u8aaa\u660e\u4f4d\u7f6e\u3001\u5de5\u5e8f\u6216\u98a8\u96aa\u9ede"}
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
                    <div className="text-base font-medium">
                      {"\u9ede\u64ca\u62cd\u651d\u6216\u4e0a\u50b3"}
                    </div>
                    <div className="mt-1 text-xs text-white/70">
                      JPG / PNG / WebP · {"\u5efa\u8b70\u7784\u6e96\u6f0f\u6d1e\u8207\u4f5c\u696d\u9762"}
                    </div>
                  </>
                )}
                {preview && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-left text-xs">
                    {"\u9ede\u64ca\u66f4\u63db\u7167\u7247"}
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
                  {"\u4e0a\u50b3\u8a9e\u97f3"}
                </button>
                {file && (
                  <p className="axon-muted mt-3 text-xs">{file.name}</p>
                )}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                {mode === "chat"
                  ? "WhatsApp / \u8a0a\u606f\u5167\u5bb9"
                  : "\u88dc\u5145\u8aaa\u660e\uff08\u53ef\u9078\uff09"}
              </label>
              <textarea
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3.5 py-3 text-sm outline-none ring-[var(--axon-steel)]/20 focus:ring-2"
                rows={mode === "chat" ? 7 : 3}
                placeholder={
                  mode === "chat"
                    ? "[10:21] \u73fe\u5834\u4e3b\u7ba1\uff1aB\u5340\u4e94\u6a13\u570d\u6b04\u672a\u88dd"
                    : "\u4f8b\u5982\uff1aB\u53405\u6a13\u5e73\u53f0\u3001\u6a21\u677f\u4f5c\u696d"
                }
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>

            <button
              disabled={busy || (!file && !text)}
              onClick={extract}
              className="axon-btn axon-btn-primary w-full"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              {busy ? "AI \u5206\u6790\u4e2d\u2026" : "\u958b\u59cb\u5206\u6790"}
            </button>
            {error && <p className="text-sm text-rose-600">{error}</p>}
          </div>
        </section>

        {/* Right: insights */}
        <section className="axon-panel overflow-hidden">
          <div className="border-b border-[var(--axon-line)] px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--axon-ink)]">
              {"\u5206\u6790\u7d50\u679c"}
            </h2>
            <p className="axon-muted mt-0.5 text-xs">
              {"\u6f0f\u6d1e \u00b7 \u9032\u5ea6 \u00b7 \u5efa\u8b70\u52d5\u4f5c"}
            </p>
          </div>

          <div className="p-5">
            {!result ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-[var(--axon-steel)]">
                  <ShieldAlert size={20} />
                </div>
                <p className="text-sm font-medium text-slate-700">
                  {"\u4e0a\u50b3\u7167\u7247\u5f8c\uff0c\u9019\u88e1\u6703\u51fa\u73fe"}
                </p>
                <ul className="axon-muted mt-3 space-y-1 text-xs">
                  <li>{"\u00b7 \u5b89\u5168\u6f0f\u6d1e\uff08\u570d\u6b04\u3001\u6d1e\u53e3\u3001PPE\uff09"}</li>
                  <li>{"\u00b7 \u8cea\u91cf\u7f3a\u9677\uff08\u92fc\u7b4b\u3001\u88c2\u7e2b\uff09"}</li>
                  <li>{"\u00b7 \u9032\u5ea6\u4f30\u7b97\uff08\u53ef\u898b\u5b8c\u6210\u5ea6\uff09"}</li>
                </ul>
              </div>
            ) : (
              <div className="space-y-5">
                {result.mock && (
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {"真實 AI 模式未生效時會顯示此提示。請確認 OpenRouter Key 已設定並重啟服務。"}
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[var(--axon-navy)] px-2.5 py-0.5 text-[11px] text-white">
                      {CATEGORY_LABELS[result.category] || result.category}
                    </span>
                    <span className={cn("text-xs font-semibold", SEVERITY_COLORS[result.severity])}>
                      {SEVERITY_LABELS[result.severity]}{" "}
                      {"\u98a8\u96aa"}
                    </span>
                    <span className="text-xs text-slate-400">
                      {"\u7f6e\u4fe1\u5ea6 "}
                      {Math.round((result.confidence || 0) * 100)}%
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Gauge size={13} />
                      {"\u76ee\u8996\u9032\u5ea6"}
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
                      {"\u4e3b\u8981\u5de5\u5e8f"}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-[var(--axon-ink)]">
                      {result.workActivity || "\u2014"}
                    </div>
                    <div className="axon-muted mt-2 text-xs">{result.location}</div>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {"\u767c\u73fe\u7684\u6f0f\u6d1e\u8207\u554f\u984c"}
                  </h3>
                  <div className="space-y-2">
                    {(result.findings || []).length === 0 && (
                      <p className="text-sm text-slate-400">
                        {"\u66ab\u672a\u5217\u51fa\u5177\u9ad4\u767c\u73fe"}
                      </p>
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
                                : "bg-emerald-500"
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

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    {"\u5efa\u8b70\u52d5\u4f5c"}
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
                    {"\u66f4\u591a\u9078\u9805\uff08\u5206\u985e\uff0f\u6307\u6d3e\uff09"}
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
                        <span className="text-xs font-medium text-slate-500">
                          {"\u8ca0\u8cac\u4eba"}
                        </span>
                        <select
                          className="axon-input"
                          value={assigneeId}
                          onChange={(e) => setAssigneeId(e.target.value)}
                        >
                          <option value="">{"\u9ed8\u8a8d\uff08\u7576\u524d\u767b\u5165\uff09"}</option>
                          {people.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-500">
                          {"\u5206\u5224\u516c\u53f8"}
                        </span>
                        <select
                          className="axon-input"
                          value={subcontractorId}
                          onChange={(e) => setSubcontractorId(e.target.value)}
                        >
                          <option value="">{"\u5f85\u6307\u6d3e"}</option>
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

                <button
                  disabled={busy}
                  onClick={createCase}
                  className="axon-btn axon-btn-ok w-full"
                >
                  <CheckCircle2 size={16} />
                  {"\u78ba\u8a8d\u4e26\u5efa\u7acb\u4e8b\u4ef6"}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
