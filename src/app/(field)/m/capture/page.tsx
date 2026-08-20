"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { isBrowserUnsupportedImage, isProbablyImage } from "@/lib/media";
import { SEVERITY_COLORS, cn } from "@/lib/labels";
import { useI18n } from "@/components/I18nProvider";

type ExtractResult = {
  title: string;
  description: string;
  category: string;
  severity: string;
  location: string;
  recommendation: string;
  tags?: string[];
};

export default function FieldCapturePage() {
  const router = useRouter();
  const { t, categoryLabels, severityLabels } = useI18n();
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [busy, setBusy] = useState<"save" | "analyze" | "case" | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

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
      setError(t("capture.heic"));
      return;
    }
    if (isProbablyImage(f)) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  }

  async function saveEvidence() {
    if (!file && !note.trim()) {
      setError(t("field.needPhoto"));
      return;
    }
    setBusy("save");
    setError("");
    const form = new FormData();
    form.set("source", "UPLOAD");
    form.set("title", result?.title || file?.name || t("capture.siteLog"));
    form.set("chatText", note);
    form.set("skipAi", "1");
    if (result) form.set("aiJson", JSON.stringify(result));
    if (file) form.set("file", file);
    const res = await fetch("/api/evidence", { method: "POST", body: form });
    setBusy(null);
    if (!res.ok) {
      setError(t("capture.saveEvidenceFail"));
      return;
    }
    setMsg(t("field.savedEvidence"));
    setTimeout(() => setMsg(""), 2200);
  }

  async function analyze() {
    if (!file && !note.trim()) {
      setError(t("field.needPhoto"));
      return;
    }
    setBusy("analyze");
    setError("");
    const form = new FormData();
    form.set("text", note);
    form.set("analysisMode", "discover");
    if (file) form.set("file", file);
    const res = await fetch("/api/ai/extract", { method: "POST", body: form });
    setBusy(null);
    if (!res.ok) {
      setError(t("capture.analyzeFail"));
      return;
    }
    setResult(await res.json());
  }

  async function createCase() {
    if (!result) return;
    setBusy("case");
    let evidenceId: string | undefined;
    const form = new FormData();
    form.set("source", "UPLOAD");
    form.set("title", result.title);
    form.set("chatText", note);
    form.set("skipAi", "1");
    form.set("aiJson", JSON.stringify(result));
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
        sourceType: "PHOTO",
        evidenceId,
        createTask: true,
        dueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      }),
    });
    setBusy(null);
    if (!res.ok) {
      setError(t("capture.createCaseFail"));
      return;
    }
    const created = await res.json();
    router.push(`/cases/${created.id}`);
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
        className="relative flex min-h-[320px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#0c2340_0%,#163a5f_55%,#3d5a80_100%)] text-white"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--axon-accent)] shadow-lg">
              <Camera size={28} />
            </span>
            <div className="text-lg font-semibold">{t("field.shot")}</div>
            <div className="mt-1 text-xs text-white/70">{t("capture.formatHint")}</div>
          </>
        )}
        {preview && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-left text-xs">
            {t("field.retake")}
          </div>
        )}
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="axon-btn axon-btn-primary h-11"
        >
          <Camera size={16} />
          {t("field.shot")}
        </button>
        <button type="button" onClick={() => albumRef.current?.click()} className="axon-btn axon-btn-ghost h-11">
          <ImagePlus size={16} />
          {t("field.album")}
        </button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
      <input
        ref={albumRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-500">{t("field.note")}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={t("field.notePh")}
          className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm"
        />
      </label>

      {error && <p className="text-sm text-[var(--axon-danger)]">{error}</p>}
      {msg && <p className="text-sm text-[var(--axon-ok)]">{msg}</p>}

      <button
        type="button"
        disabled={Boolean(busy)}
        onClick={() => void saveEvidence()}
        className="axon-btn axon-btn-ok h-12 w-full text-base"
      >
        {busy === "save" ? <Loader2 size={18} className="animate-spin" /> : null}
        {t("field.saveEvidence")}
      </button>

      <button
        type="button"
        disabled={Boolean(busy)}
        onClick={() => void analyze()}
        className="axon-btn axon-btn-ghost h-11 w-full"
      >
        {busy === "analyze" ? <Loader2 size={16} className="animate-spin" /> : null}
        {t("field.analyze")}
      </button>

      {result && (
        <section className="axon-panel space-y-2 p-4">
          <h2 className="text-base font-semibold text-[var(--axon-ink)]">{result.title}</h2>
          <p className="text-sm text-slate-600">{result.description}</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-slate-100 px-2 py-0.5">
              {categoryLabels[result.category] || result.category}
            </span>
            <span className={cn("rounded-md bg-slate-100 px-2 py-0.5", SEVERITY_COLORS[result.severity])}>
              {severityLabels[result.severity] || result.severity}
            </span>
            {result.location && <span className="rounded-md bg-slate-100 px-2 py-0.5">{result.location}</span>}
          </div>
          {result.recommendation && (
            <p className="text-sm text-slate-700">{result.recommendation}</p>
          )}
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void createCase()}
            className="axon-btn axon-btn-primary mt-2 h-11 w-full"
          >
            {busy === "case" ? <Loader2 size={16} className="animate-spin" /> : null}
            {t("field.createCase")}
          </button>
        </section>
      )}
    </div>
  );
}
