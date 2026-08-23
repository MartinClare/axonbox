"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  ImagePlus,
  Loader2,
  X,
} from "lucide-react";
import { isBrowserUnsupportedImage, isProbablyImage } from "@/lib/media";
import { cn } from "@/lib/labels";
import { useI18n } from "@/components/I18nProvider";
import {
  appendGeoToForm,
  emptyCaptureGeo,
  formatCoords,
  formatHeading,
  readDeviceGeo,
  type CaptureGeo,
} from "@/lib/capture-geo";
import { tagsForFieldIntent, type FieldIntent } from "@/lib/field-intent";

const MAX_PHOTOS = 8;
const CATEGORIES = ["SAFETY", "QUALITY", "PROGRESS", "ENVIRONMENT", "OTHER"] as const;
const SEVERITIES = ["HIGH", "MEDIUM", "LOW"] as const;

type Shot = { id: string; file: File; url: string };

type ExtractResult = {
  title: string;
  description: string;
  category: string;
  severity: string;
  location: string;
  recommendation: string;
  tags?: string[];
  analysisMode?: "record" | "discover";
};

function newShotId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Copy into a stable File — Android WebView content URIs can go stale before save. */
async function durableImageFile(file: File, index: number): Promise<File> {
  const buf = await file.arrayBuffer();
  const type = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
  const base =
    file.name && /\.(jpe?g|png|webp|gif)$/i.test(file.name)
      ? file.name
      : `field-${Date.now()}-${index + 1}.jpg`;
  return new File([buf], base, { type, lastModified: Date.now() });
}

function evidenceItemsFromResponse(data: unknown): { id: string }[] {
  if (!data || typeof data !== "object") return [];
  const o = data as { id?: string; items?: { id?: string }[] };
  if (Array.isArray(o.items)) {
    return o.items.filter((x): x is { id: string } => Boolean(x?.id));
  }
  if (o.id) return [{ id: o.id }];
  return [];
}

export default function FieldCapturePage() {
  const router = useRouter();
  const { t, categoryLabels, severityLabels } = useI18n();
  const cameraRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [liveReady, setLiveReady] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [intent, setIntent] = useState<FieldIntent>("later");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("OTHER");
  const [severity, setSeverity] = useState<string>("LOW");
  const [location, setLocation] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [busy, setBusy] = useState<"ai" | "save" | "case" | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [geo, setGeo] = useState<CaptureGeo>(() => emptyCaptureGeo());

  const active = shots.find((s) => s.id === activeId) || shots[shots.length - 1] || null;
  const hasGeo = geo.lat != null && geo.lng != null;

  function stopLivePreview() {
    const stream = streamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setLiveReady(false);
  }

  async function startLivePreview() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
    stopLivePreview();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await video.play().catch(() => undefined);
      }
      setLiveReady(true);
    } catch {
      setLiveReady(false);
    }
  }

  useEffect(() => {
    void readDeviceGeo({ timeoutMs: 8000 }).then((next) => {
      if (next.lat != null || next.headingDeg != null) {
        setGeo({ lat: next.lat, lng: next.lng, headingDeg: next.headingDeg });
      }
    });
  }, []);

  useEffect(() => {
    if (sheetOpen) {
      stopLivePreview();
      return;
    }
    void startLivePreview();
    const onVis = () => {
      if (document.visibilityState === "visible" && !streamRef.current) {
        void startLivePreview();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stopLivePreview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen]);

  useEffect(() => {
    return () => {
      stopLivePreview();
      for (const s of shots) URL.revokeObjectURL(s.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function captureGeo() {
    const next = await readDeviceGeo({ timeoutMs: 6000 });
    if (next.lat != null || next.headingDeg != null) {
      setGeo({ lat: next.lat, lng: next.lng, headingDeg: next.headingDeg });
    }
  }

  async function snapFromLivePreview(): Promise<boolean> {
    const video = videoRef.current;
    if (!liveReady || !video || video.videoWidth < 2) return false;
    if (shots.length >= MAX_PHOTOS) return true;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
    );
    if (!blob) return false;
    const file = new File([blob], `field-${Date.now()}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
    addFiles([file]);
    return true;
  }

  async function onShutter() {
    if (shots.length >= MAX_PHOTOS) return;
    const snapped = await snapFromLivePreview();
    if (snapped) return;
    // Native one-shot needs the camera free.
    stopLivePreview();
    cameraRef.current?.click();
  }

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const incoming = Array.from(list);
    setError("");
    void (async () => {
      const prepared: Shot[] = [];
      for (let i = 0; i < incoming.length; i++) {
        const f = incoming[i];
        if (isBrowserUnsupportedImage(f)) {
          setError(t("capture.heic"));
          continue;
        }
        if (!isProbablyImage(f) && !(f.type === "" && f.size > 0)) continue;
        try {
          const durable = await durableImageFile(f, i);
          if (durable.size === 0) continue;
          prepared.push({
            id: newShotId(),
            file: durable,
            url: URL.createObjectURL(durable),
          });
        } catch {
          setError(t("capture.saveEvidenceFail"));
        }
      }
      if (!prepared.length) return;
      setShots((prev) => {
        const next = [...prev];
        for (const shot of prepared) {
          if (next.length >= MAX_PHOTOS) {
            URL.revokeObjectURL(shot.url);
            continue;
          }
          next.push(shot);
          setActiveId(shot.id);
        }
        return next;
      });
      void captureGeo();
      // Resume live view after native capture returns.
      if (!sheetOpen) void startLivePreview();
    })();
  }

  function removeShot(id: string) {
    setShots((prev) => {
      const victim = prev.find((s) => s.id === id);
      if (victim) URL.revokeObjectURL(victim.url);
      const next = prev.filter((s) => s.id !== id);
      if (activeId === id) setActiveId(next[next.length - 1]?.id || null);
      if (next.length === 0) setSheetOpen(false);
      return next;
    });
  }

  function openSheet() {
    if (!shots.length) {
      setError(t("field.needPhoto"));
      return;
    }
    setError("");
    setMsg("");
    setSheetOpen(true);
    setIntent("later");
    setResult(null);
    setTitle("");
    setDescription("");
    setCategory("OTHER");
    setSeverity("LOW");
    setLocation("");
    setRecommendation("");
    setTags(tagsForFieldIntent("later"));
  }

  function applyExtract(data: ExtractResult, nextIntent: FieldIntent) {
    setResult(data);
    setTitle(data.title || "");
    setDescription(data.description || "");
    setCategory(data.category || "OTHER");
    setSeverity(data.severity || (nextIntent === "issue" ? "MEDIUM" : "LOW"));
    setLocation(data.location || "");
    setRecommendation(data.recommendation || "");
    const intentTags = tagsForFieldIntent(nextIntent);
    const fromAi = Array.isArray(data.tags) ? data.tags.filter(Boolean) : [];
    setTags([...new Set([...intentTags, ...fromAi])].slice(0, 12));
  }

  async function selectIntent(next: FieldIntent) {
    setIntent(next);
    setError("");
    setTags(tagsForFieldIntent(next));
    if (next === "later") {
      setResult(null);
      setTitle("");
      setDescription("");
      setRecommendation("");
      setCategory("OTHER");
      setSeverity("LOW");
      return;
    }
    if (!shots.length) return;
    setBusy("ai");
    const form = new FormData();
    form.set("text", note);
    form.set("fieldIntent", next);
    form.set("analysisMode", next === "done" ? "record" : "discover");
    form.set("file", shots[0].file);
    const res = await fetch("/api/ai/extract", { method: "POST", body: form });
    setBusy(null);
    if (!res.ok) {
      setError(t("capture.analyzeFail"));
      return;
    }
    applyExtract((await res.json()) as ExtractResult, next);
  }

  function buildEvidenceForm(opts?: {
    caseId?: string;
    files?: File[];
    extract?: ExtractResult | null;
  }) {
    const files = opts?.files ?? shots.map((s) => s.file);
    const extract = opts?.extract !== undefined ? opts.extract : result;
    const form = new FormData();
    form.set("source", "UPLOAD");
    form.set(
      "title",
      title.trim() || extract?.title || files[0]?.name || t("capture.siteLog"),
    );
    form.set("chatText", note);
    form.set("skipAi", "1");
    form.set("tagsJson", JSON.stringify(tags.length ? tags : tagsForFieldIntent(intent)));
    if (extract) {
      form.set(
        "aiJson",
        JSON.stringify({
          ...extract,
          title: title.trim() || extract.title,
          description: description.trim() || extract.description,
          category: category || extract.category,
          severity: severity || extract.severity,
          location: location.trim() || extract.location,
          recommendation: recommendation.trim() || extract.recommendation,
          tags,
        }),
      );
    }
    if (opts?.caseId) form.set("caseId", opts.caseId);
    for (const file of files) form.append("file", file);
    appendGeoToForm(form, geo);
    return form;
  }

  async function uploadShots(opts?: { caseId?: string; extract?: ExtractResult | null }) {
    const files = shots.map((s) => s.file).filter((f) => f.size > 0);
    if (!files.length) throw new Error("no-files");
    const res = await fetch("/api/evidence", {
      method: "POST",
      body: buildEvidenceForm({
        caseId: opts?.caseId,
        files,
        extract: opts?.extract,
      }),
    });
    if (!res.ok) throw new Error("upload-failed");
    const items = evidenceItemsFromResponse(await res.json());
    if (!items.length) throw new Error("upload-empty");
    return items;
  }

  async function savePhotosOnly() {
    if (!shots.length) {
      setError(t("field.needPhoto"));
      return;
    }
    setBusy("save");
    setError("");
    try {
      await uploadShots();
      setMsg(t("field.savedEvidence"));
      setTimeout(() => {
        setMsg("");
        resetAfterSave();
        router.push("/m/evidence");
      }, 700);
    } catch {
      setError(t("capture.saveEvidenceFail"));
    } finally {
      setBusy(null);
    }
  }

  async function createCaseNow() {
    if (!shots.length) {
      setError(t("field.needPhoto"));
      return;
    }
    setBusy("case");
    setError("");
    try {
      let draft = result;
      if (!draft) {
        const form = new FormData();
        form.set("text", note);
        form.set("fieldIntent", "issue");
        form.set("analysisMode", "discover");
        form.set("file", shots[0].file);
        const aiRes = await fetch("/api/ai/extract", { method: "POST", body: form });
        if (aiRes.ok) {
          draft = (await aiRes.json()) as ExtractResult;
          applyExtract(draft, "issue");
        }
      }

      // Save every rolled photo first (no second picker), then open the case on them.
      const items = await uploadShots({ extract: draft });
      const caseTitle = title.trim() || draft?.title || t("capture.siteLog");
      const caseRes = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: caseTitle,
          description: description.trim() || draft?.description || "",
          category: category || draft?.category || "OTHER",
          severity: severity || draft?.severity || "MEDIUM",
          location: location.trim() || draft?.location || "",
          recommendation: recommendation.trim() || draft?.recommendation || "",
          sourceType: "PHOTO",
          evidenceId: items[0].id,
          createTask: true,
          dueAt: new Date(Date.now() + 2 * 86400000).toISOString(),
        }),
      });
      if (!caseRes.ok) throw new Error("case-failed");
      const created = (await caseRes.json()) as { id: string };
      await Promise.all(
        items.slice(1).map((item) =>
          fetch(`/api/evidence/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ caseId: created.id }),
          }),
        ),
      );
      resetAfterSave();
      // Stay in the field app — desktop case page prompts for more “after” photos.
      router.push("/m/cases");
    } catch {
      setError(t("capture.createCaseFail"));
    } finally {
      setBusy(null);
    }
  }

  function resetAfterSave() {
    for (const s of shots) URL.revokeObjectURL(s.url);
    setShots([]);
    setActiveId(null);
    setSheetOpen(false);
    setIntent("later");
    setNote("");
    setTitle("");
    setDescription("");
    setResult(null);
    setTags([]);
  }

  const primaryAction =
    intent === "issue"
      ? { label: t("field.createCase"), run: () => void createCaseNow() }
      : { label: t("field.saveEvidence"), run: () => void savePhotosOnly() };

  return (
    <div className="flex flex-col">
      {!sheetOpen && (
        <div className="relative flex min-h-[calc(100dvh-8.5rem)] flex-col bg-black">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              liveReady ? "opacity-100" : "opacity-0",
            )}
          />
          {!liveReady && (
            <div className="absolute inset-0 flex items-center justify-center text-white/40">
              {active ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={active.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <Camera size={36} />
              )}
            </div>
          )}

          {(hasGeo || geo.headingDeg != null) && (
            <div className="pointer-events-none absolute left-3 top-16 z-10 rounded-full bg-black/50 px-2.5 py-1 text-[11px] text-white/90">
              {hasGeo ? formatCoords(geo.lat!, geo.lng!) : ""}
              {hasGeo && geo.headingDeg != null ? " · " : ""}
              {geo.headingDeg != null ? formatHeading(geo.headingDeg) : ""}
            </div>
          )}

          {shots.length > 0 && (
            <div className="pointer-events-auto absolute inset-x-0 bottom-[7.5rem] z-10 flex gap-2 overflow-x-auto px-4">
              {shots.map((shot, i) => (
                <div
                  key={shot.id}
                  className={cn(
                    "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2",
                    active?.id === shot.id ? "ring-[var(--axon-accent)]" : "ring-white/40",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setActiveId(shot.id)}
                    className="absolute inset-0"
                    aria-label={`${i + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={shot.url} alt="" className="h-full w-full object-cover" />
                  </button>
                  <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeShot(shot.id)}
                    className="absolute right-0.5 top-0.5 z-10 rounded-full bg-black/70 p-0.5 text-white"
                    aria-label={t("common.delete")}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 to-transparent px-5 pb-5 pt-16">
            <div className="pointer-events-auto flex items-center justify-between">
              <button
                type="button"
                onClick={() => albumRef.current?.click()}
                disabled={shots.length >= MAX_PHOTOS}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-white disabled:opacity-40"
                aria-label={t("field.album")}
              >
                <ImagePlus size={20} />
              </button>
              <button
                type="button"
                onClick={() => void onShutter()}
                disabled={shots.length >= MAX_PHOTOS}
                className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-white bg-white/20 disabled:opacity-40"
                aria-label={t("field.shot")}
              >
                <span className="h-14 w-14 rounded-full bg-white" />
              </button>
              {shots.length > 0 ? (
                <button
                  type="button"
                  onClick={openSheet}
                  className="flex h-12 min-w-12 items-center justify-center rounded-full bg-[var(--axon-accent)] px-3 text-sm font-semibold text-white"
                >
                  {t("field.done")}
                  <span className="ml-1 text-xs opacity-90">{shots.length}</span>
                </button>
              ) : (
                <span className="h-12 w-12" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Only mount pickers while shooting — never while saving from the form sheet. */}
      {!sheetOpen && (
        <>
          <input
            ref={cameraRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={albumRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </>
      )}
      {sheetOpen && (
        <div className="space-y-4 bg-[var(--background)] px-4 pb-6 pt-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="text-sm font-medium text-[var(--axon-blue)]"
            >
              {t("field.morePhotos")}
            </button>
            <span className="text-xs text-slate-500">
              {t("field.photoCount", { n: shots.length })}
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {shots.map((shot) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={shot.id}
                src={shot.url}
                alt=""
                className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-[var(--axon-line)]"
              />
            ))}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t("field.purpose")}
            </p>
            <div className="grid grid-cols-1 gap-2">
              {(
                [
                  ["later", Clock3, "field.intentLater", "field.intentLaterHint"],
                  ["issue", AlertTriangle, "field.intentIssue", "field.intentIssueHint"],
                  ["done", CheckCircle2, "field.intentDone", "field.intentDoneHint"],
                ] as const
              ).map(([key, Icon, labelKey, hintKey]) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy === "ai"}
                  onClick={() => void selectIntent(key)}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition",
                    intent === key
                      ? "border-[var(--axon-brand)] bg-[var(--axon-sand)]"
                      : "border-[var(--axon-line)] bg-white",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      key === "issue"
                        ? "bg-rose-100 text-rose-700"
                        : key === "done"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-600",
                    )}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-[var(--axon-ink)]">
                      {t(labelKey)}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">{t(hintKey)}</span>
                  </span>
                  {intent === key && <Check size={16} className="mt-1 text-[var(--axon-brand)]" />}
                </button>
              ))}
            </div>
          </div>

          {busy === "ai" && (
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <Loader2 size={16} className="animate-spin" />
              {t("capture.aiWorking")}
            </p>
          )}

          <div className="space-y-3 rounded-2xl border border-[var(--axon-line)] bg-white p-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-500">
                  {intent === "later" ? t("field.titleOptional") : t("capture.result")}
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={intent === "later" ? t("field.titleOptional") : t("capture.emptyHint")}
                  className="w-full rounded-xl border border-[var(--axon-line)] px-3 py-2.5 text-sm font-semibold"
                />
              </label>
              {intent !== "later" && (
                <>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder={t("field.notePh")}
                    className="w-full rounded-xl border border-[var(--axon-line)] px-3 py-2.5 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-xs text-slate-500">{t("field.category")}</span>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full rounded-xl border border-[var(--axon-line)] px-2.5 py-2 text-sm"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {categoryLabels[c] || c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-slate-500">{t("field.severity")}</span>
                      <select
                        value={severity}
                        onChange={(e) => setSeverity(e.target.value)}
                        className="w-full rounded-xl border border-[var(--axon-line)] px-2.5 py-2 text-sm"
                      >
                        {SEVERITIES.map((s) => (
                          <option key={s} value={s}>
                            {severityLabels[s] || s}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={t("capture.locationPh")}
                    className="w-full rounded-xl border border-[var(--axon-line)] px-3 py-2.5 text-sm"
                  />
                  {intent === "issue" && (
                    <textarea
                      value={recommendation}
                      onChange={(e) => setRecommendation(e.target.value)}
                      rows={2}
                      placeholder={t("capture.actions")}
                      className="w-full rounded-xl border border-[var(--axon-line)] px-3 py-2.5 text-sm"
                    />
                  )}
                </>
              )}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-500">{t("field.note")}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={t("field.notePh")}
              className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm"
            />
          </label>

          {error && <p className="text-sm text-[var(--axon-danger)]">{error}</p>}
          {msg && <p className="text-sm text-[var(--axon-ok)]">{msg}</p>}

          <button
            type="button"
            disabled={Boolean(busy) || !shots.length}
            onClick={primaryAction.run}
            className={cn(
              "axon-btn h-12 w-full text-base",
              intent === "issue" ? "axon-btn-primary" : "axon-btn-ok",
            )}
          >
            {busy === "save" || busy === "case" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : null}
            {primaryAction.label}
          </button>
        </div>
      )}

      {!sheetOpen && error && <p className="px-4 py-2 text-sm text-[var(--axon-danger)]">{error}</p>}
    </div>
  );
}
