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
  SEVERITY_COLORS,
  cn,
} from "@/lib/labels";
import { isProbablyImage, isBrowserUnsupportedImage } from "@/lib/media";
import { apiFetch } from "@/lib/api-client";
import { useI18n } from "@/components/I18nProvider";
import { appendGeoToForm, emptyCaptureGeo, readDeviceGeo, type CaptureGeo } from "@/lib/capture-geo";

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
  const { t, categoryLabels, severityLabels } = useI18n();
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
  const [geo, setGeo] = useState<CaptureGeo>(() => emptyCaptureGeo());
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
    void readDeviceGeo({ timeoutMs: 8000 }).then((next) => {
      if (next.lat != null || next.headingDeg != null) {
        setGeo({ lat: next.lat, lng: next.lng, headingDeg: next.headingDeg });
      }
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
      setError(t("capture.heic"));
      return;
    }
    if (isProbablyImage(f)) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  }

  function addTag(raw: string) {
    const tag = normalizeTag(raw);
    if (!tag) return;
    setTags((prev) => (prev.includes(tag) ? prev : [...prev, tag].slice(0, 20)));
    setTagDraft("");
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((x) => x !== tag));
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
      setError(t("capture.analyzeFail"));
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
    form.set("title", result?.title || file?.name || t("capture.siteLog"));
    form.set("chatText", text);
    form.set("tagsJson", JSON.stringify(tags));
    form.set("skipAi", "1");
    if (result) form.set("aiJson", JSON.stringify({ ...result, tags }));
    if (file) form.set("file", file);
    appendGeoToForm(form, geo);
    const evRes = await fetch("/api/evidence", { method: "POST", body: form });
    setBusy(false);
    if (!evRes.ok) {
      setError(t("capture.saveEvidenceFail"));
      return;
    }
    setMsg(t("capture.savedEvidence"));
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
    appendGeoToForm(form, geo);
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
      setError(t("capture.createCaseFail"));
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
          <h1 className="axon-title mt-1 text-3xl font-semibold">{t("capture.title")}</h1>
          <p className="axon-muted mt-2 max-w-xl text-sm leading-relaxed">
            {t("capture.subtitle")}
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-[var(--axon-line)] bg-white/80 p-1">
          {(
            [
              ["photo", "capture.photo", Camera],
              ["chat", "capture.message", MessageSquare],
              ["voice", "capture.voice", Mic],
            ] as const
          ).map(([k, labelKey, Icon]) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm transition",
                mode === k
                  ? "bg-[var(--axon-brand)] text-white"
                  : "text-slate-600 hover:bg-slate-50",
              )}
            >
              <Icon size={14} />
              {t(labelKey)}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="axon-panel overflow-hidden">
          <div className="border-b border-[var(--axon-line)] px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--axon-ink)]">
              {mode === "photo" ? t("capture.sitePhoto") : mode === "chat" ? t("capture.msgImport") : t("capture.voiceLog")}
            </h2>
            <p className="axon-muted mt-0.5 text-xs">
              {mode === "photo"
                ? t("capture.photoHint")
                : mode === "chat"
                  ? t("capture.msgHint")
                  : t("capture.voiceHint")}
            </p>
          </div>

          <div className="space-y-4 p-5">
            {mode === "photo" && (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="group relative flex min-h-[220px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-[var(--axon-steel)]/35 bg-[linear-gradient(160deg,#0c2340_0%,#163a5f_55%,#3d5a80_100%)] text-white transition hover:brightness-110 md:min-h-[260px]"
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
                      <div className="text-base font-medium">{t("capture.clickUpload")}</div>
                      <div className="mt-1 text-xs text-white/70">
                        {t("capture.formatHint")}
                      </div>
                    </>
                  )}
                  {preview && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-left text-xs">
                      {t("capture.changePhoto")}
                    </div>
                  )}
                </button>
              </div>
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
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--axon-brand)] px-4 py-2 text-sm text-white"
                >
                  <Mic size={14} />
                  {t("capture.uploadVoice")}
                </button>
                {file && <p className="axon-muted mt-3 text-xs">{file.name}</p>}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500">
                {mode === "chat" ? t("capture.waContent") : t("capture.extraOpt")}
              </label>
              <textarea
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3.5 py-3 text-sm outline-none ring-[var(--axon-steel)]/20 focus:ring-2"
                rows={mode === "chat" ? 7 : 3}
                placeholder={
                  mode === "chat"
                    ? t("capture.chatPh")
                    : t("capture.locationPh")
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
                  {busyMode === "record" ? t("capture.recording") : t("capture.recordStatus")}
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
                  {busyMode === "discover" ? t("capture.analyzing") : t("capture.findIssue")}
                </button>
              </div>
            ) : (
              <button
                disabled={busy || (!file && !text)}
                onClick={() => extract("discover")}
                className="axon-btn axon-btn-primary w-full"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                {busy ? t("capture.aiWorking") : t("capture.startAnalyze")}
              </button>
            )}
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {msg && <p className="text-sm text-emerald-700">{msg}</p>}
          </div>
        </section>

        <section className="axon-panel overflow-hidden">
          <div className="border-b border-[var(--axon-line)] px-5 py-4">
            <h2 className="text-sm font-semibold text-[var(--axon-ink)]">{t("capture.result")}</h2>
            <p className="axon-muted mt-0.5 text-xs">
              {isRecord ? t("capture.resultStatus") : t("capture.resultIssue")}
            </p>
          </div>

          <div className="p-5">
            {!result ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-[var(--axon-steel)]">
                  <ShieldAlert size={20} />
                </div>
                <p className="text-sm font-medium text-slate-700">{t("capture.emptyHint")}</p>
                <ul className="axon-muted mt-3 space-y-1 text-xs">
                  <li>· {t("capture.bulletStatus")}</li>
                  <li>· {t("capture.bulletIssue")}</li>
                  <li>· {t("capture.bulletTags")}</li>
                </ul>
              </div>
            ) : (
              <div className="space-y-5">
                {result.mock && (
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    {t("capture.mockBanner")}
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] text-white",
                        isRecord ? "bg-sky-700" : "bg-[var(--axon-brand)]",
                      )}
                    >
                      {isRecord ? t("capture.recordStatus") : t("capture.findIssue")}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-700">
                      {categoryLabels[result.category] || result.category}
                    </span>
                    <span className={cn("text-xs font-semibold", SEVERITY_COLORS[result.severity])}>
                      {t("capture.severityRisk", { label: severityLabels[result.severity] || result.severity })}
                    </span>
                    <span className="text-xs text-slate-400">
                      {t("capture.confidence", { n: Math.round((result.confidence || 0) * 100) })}
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
                    {t("capture.tags")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="inline-flex items-center gap-1 rounded-full bg-[#e8f4fb] px-2.5 py-1 text-xs font-medium text-[#02445f]"
                        title={t("capture.removeTag")}
                      >
                        #{tag}
                        <X size={11} className="opacity-60" />
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      className="axon-input min-h-0 flex-1 py-2 text-sm"
                      placeholder={t("capture.addTagPh")}
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
                      {t("common.addItem")}
                    </button>
                  </div>
                  {suggestable.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {suggestable.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => addTag(tag)}
                          className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] text-slate-500 hover:border-[var(--axon-steel)] hover:text-[var(--axon-ink)]"
                        >
                          + {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Gauge size={13} />
                      {t("capture.visualProgress")}
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
                      {t("capture.mainActivity")}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-[var(--axon-ink)]">
                      {result.workActivity || t("common.none")}
                    </div>
                    <div className="axon-muted mt-2 text-xs">{result.location}</div>
                  </div>
                </div>

                {(!isRecord || (result.findings || []).length > 0) && (
                  <div>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {isRecord ? t("capture.summaryObs") : t("capture.findings")}
                    </h3>
                    <div className="space-y-2">
                      {(result.findings || []).length === 0 && (
                        <p className="text-sm text-slate-400">{t("capture.noFindings")}</p>
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
                    {isRecord ? t("capture.notes") : t("capture.actions")}
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
                    {t("capture.moreOptions")}
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        className="axon-input"
                        value={result.category}
                        onChange={(e) => setResult({ ...result, category: e.target.value })}
                      >
                        {Object.entries(categoryLabels).map(([k, v]) => (
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
                        {Object.entries(severityLabels).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-500">{t("capture.assignee")}</span>
                        <select
                          className="axon-input"
                          value={assigneeId}
                          onChange={(e) => setAssigneeId(e.target.value)}
                        >
                          <option value="">{t("capture.assigneeDefault")}</option>
                          {people.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block space-y-1">
                        <span className="text-xs font-medium text-slate-500">{t("capture.sub")}</span>
                        <select
                          className="axon-input"
                          value={subcontractorId}
                          onChange={(e) => setSubcontractorId(e.target.value)}
                        >
                          <option value="">{t("capture.pendingAssign")}</option>
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
                      {t("capture.saveEvidenceOnly")}
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={createCase}
                    className={cn("axon-btn axon-btn-ok w-full", !isRecord && "sm:col-span-2")}
                  >
                    <CheckCircle2 size={16} />
                    {t("capture.confirmCreateCase")}
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
