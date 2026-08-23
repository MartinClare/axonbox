"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Timeline } from "@/components/Timeline";
import {
  STATUS_COLORS,
  CATEGORY_COLORS,
  cn,
  daysRemaining,
  formatDate,
} from "@/lib/labels";
import { mediaUrl } from "@/lib/media";
import { apiFetch, asArray } from "@/lib/api-client";
import {
  findAfterEvidence,
  parseEvidenceTags,
  tagsIncludeAfter,
  tagsIncludeFieldCompletion,
} from "@/lib/case-closeout";
import {
  caseLoopSubtitle,
  getCaseLoopState,
  type CaseLoopNextAction,
} from "@/lib/case-loop";
import { CaseLoopNextPanel, CaseLoopStepper } from "@/components/CaseLoopStepper";
import { useI18n } from "@/components/I18nProvider";
import { splitSourcePack } from "@/lib/inbox-source-pack";

type CaseDetail = {
  id: string;
  caseNo: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  location: string;
  status: string;
  recommendation: string | null;
  dueAt: string | null;
  discoveredAt: string;
  closedAt?: string | null;
  assigneeId?: string | null;
  subcontractorId?: string | null;
  assignee?: { id: string; name: string } | null;
  subcontractor?: { id: string; name: string } | null;
  events: Array<{
    id: string;
    type: string;
    note: string | null;
    createdAt: string;
    actor?: { name: string } | null;
  }>;
  evidence: Array<{
    id: string;
    title: string;
    type: string;
    mime?: string | null;
    filePath: string | null;
    chatText: string | null;
    tagsJson?: string | null;
    createdAt?: string;
  }>;
  tasks: Array<{ id: string; title: string; status: string; instructions: string | null }>;
  project: { name: string; siteCode: string };
};

function LinkedSource({ text }: { text: string }) {
  const re = /(\+852\s?\d{8}|\+[1-9]\d{7,14}|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.includes("@")) {
      nodes.push(
        <a key={match.index} href={`mailto:${token}`} className="text-[var(--axon-blue)] underline">
          {token}
        </a>,
      );
    } else {
      nodes.push(
        <a key={match.index} href={`tel:${token.replace(/\s/g, "")}`} className="text-[var(--axon-blue)] underline">
          {token}
        </a>,
      );
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return <span className="whitespace-pre-wrap break-words">{nodes}</span>;
}

export default function CaseDetailPage() {
  const { t, locale, categoryLabels, severityLabels, caseStatusLabels } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<CaseDetail | null>(null);
  const [subs, setSubs] = useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [tab, setTab] = useState<"details" | "progress" | "files" | "logs">("details");
  const [assign, setAssign] = useState({
    subcontractorId: "",
    assigneeId: "",
    dueAt: "",
    instructions: "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgErr, setMsgErr] = useState(false);
  const [waiveOpen, setWaiveOpen] = useState(false);
  const [waiveNote, setWaiveNote] = useState("");
  const afterPhotoInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({
    title: "",
    description: "",
    category: "OTHER",
    severity: "MEDIUM",
    location: "",
    recommendation: "",
    dueAt: "",
    assigneeId: "",
    subcontractorId: "",
  });
  const [fieldPickerOpen, setFieldPickerOpen] = useState(false);
  const [fieldLibrary, setFieldLibrary] = useState<
    Array<{
      id: string;
      title: string;
      filePath: string | null;
      mime: string | null;
      tagsJson?: string | null;
      caseId?: string | null;
    }>
  >([]);
  const [fieldLibraryLoading, setFieldLibraryLoading] = useState(false);
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);

  function flash(text: string, err = false) {
    setMsg(text);
    setMsgErr(err);
  }

  function syncEditFromCase(c: CaseDetail) {
    setEdit({
      title: c.title || "",
      description: c.description || "",
      category: c.category || "OTHER",
      severity: c.severity || "MEDIUM",
      location: c.location || "",
      recommendation: c.recommendation || "",
      dueAt: c.dueAt ? c.dueAt.slice(0, 10) : "",
      assigneeId: c.assigneeId || c.assignee?.id || "",
      subcontractorId: c.subcontractorId || c.subcontractor?.id || "",
    });
  }

  async function load() {
    const [cRes, sRes] = await Promise.all([
      apiFetch<CaseDetail>(`/api/cases/${id}`),
      apiFetch<{ subcontractors?: Array<{ id: string; name: string }>; users?: Array<{ id: string; name: string }> }>(
        "/api/settings",
      ),
    ]);
    if (!cRes.ok || !cRes.data || typeof cRes.data !== "object" || !("id" in cRes.data)) {
      setItem(null);
      flash(cRes.ok ? t("case.notFound") : cRes.error, true);
      return;
    }
    const c = cRes.data;
    setItem(c);
    syncEditFromCase(c);
    setSubs(sRes.ok ? asArray(sRes.data?.subcontractors) : []);
    setUsers(sRes.ok ? asArray(sRes.data?.users) : []);
    setAssign((a) => ({
      ...a,
      subcontractorId: c.subcontractorId || c.subcontractor?.id || "",
      assigneeId: c.assigneeId || c.assignee?.id || "",
      instructions: c.recommendation || "",
      dueAt: c.dueAt ? c.dueAt.slice(0, 10) : "",
    }));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const afterPhotos = useMemo(() => {
    if (!item) return [];
    return findAfterEvidence(
      item.evidence.map((e) => ({
        ...e,
        createdAt: e.createdAt || item.discoveredAt,
      })),
      item.events,
    );
  }, [item]);

  const afterReady = afterPhotos.length > 0;

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    flash("");
    const res = await fetch(`/api/cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      flash(data.message || data.error || t("common.failed"), true);
      return false;
    }
    flash(t("common.updated"));
    await load();
    router.refresh();
    return true;
  }

  async function tryClose() {
    if (!item) return;
    if (!afterReady) {
      setWaiveOpen(true);
      flash(t("case.needAfter"), true);
      return;
    }
    await patch({
      status: "CLOSED",
      eventType: "CLOSE",
      eventNote: t("case.closeNote"),
    });
  }

  async function confirmWaiveClose() {
    const note = waiveNote.trim();
    if (!note) {
      flash(t("case.needWaiveNote"), true);
      return;
    }
    const ok = await patch({
      status: "CLOSED",
      waiveCloseEvidence: true,
      eventNote: note,
    });
    if (ok) {
      setWaiveOpen(false);
      setWaiveNote("");
    }
  }

  async function downloadArchive() {
    const res = await fetch(`/api/cases/${id}/archive`);
    const data = await res.json();
    if (data.filePath) window.open(data.filePath, "_blank");
  }

  async function downloadPack() {
    setBusy(true);
    flash("");
    const res = await fetch(`/api/cases/${id}/pack`);
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      flash(data.error || t("case.packFail"), true);
      return;
    }
    if (data.filePath) window.open(data.filePath, "_blank");
    flash(t("case.packOk"));
  }

  async function attachAfterPhotos(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.size > 0).slice(0, 20);
    if (list.length === 0) return;
    setBusy(true);
    flash("");
    const form = new FormData();
    form.set("caseId", String(id));
    form.set("skipAi", "1");
    form.set("source", "UPLOAD");
    form.set("tagsJson", JSON.stringify(["整改後"]));
    for (const file of list) form.append("file", file);
    const res = await fetch("/api/evidence", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      flash((data as { error?: string }).error || t("case.attachAfterFail"), true);
      return;
    }
    const n = Array.isArray((data as { items?: unknown[] }).items)
      ? (data as { items: unknown[] }).items.length
      : 1;
    flash(t("case.attachAfterOk", { n }));
    setWaiveOpen(false);
    await load();
  }

  async function markAfter(evidenceId: string) {
    setBusy(true);
    const res = await fetch(`/api/evidence/${evidenceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAfter: true }),
    });
    setBusy(false);
    if (!res.ok) {
      flash(t("case.markAfterFail"), true);
      return;
    }
    flash(t("case.markAfterOk"));
    await load();
  }

  async function openFieldPhotoPicker() {
    setFieldPickerOpen(true);
    setFieldLibraryLoading(true);
    setSelectedFieldIds([]);
    const res = await apiFetch<{
      items?: Array<{
        id: string;
        title: string;
        filePath: string | null;
        mime: string | null;
        tagsJson?: string | null;
        caseId?: string | null;
        type?: string;
      }>;
    }>("/api/evidence?linked=0&pageSize=64");
    setFieldLibraryLoading(false);
    if (!res.ok) {
      setFieldLibrary([]);
      flash(res.error || t("case.pickFieldPhotosFail"), true);
      return;
    }
    const afterIds = new Set(afterPhotos.map((e) => e.id));
    const unlinked = (res.data?.items || []).filter((e) => {
      if (afterIds.has(e.id)) return false;
      if (e.mime && !e.mime.startsWith("image/") && e.type !== "PHOTO") return false;
      return true;
    });
    // Prefer field completion / defer tags at the top.
    unlinked.sort((a, b) => {
      const aDone = tagsIncludeFieldCompletion(a.tagsJson) ? 0 : 1;
      const bDone = tagsIncludeFieldCompletion(b.tagsJson) ? 0 : 1;
      return aDone - bDone;
    });
    // Also offer this case’s own photos that are not yet after-proof.
    const onCase =
      item?.evidence.filter((e) => !tagsIncludeAfter(e.tagsJson) && !afterIds.has(e.id)) || [];
    const merged = [
      ...unlinked.map((e) => ({
        id: e.id,
        title: e.title,
        filePath: e.filePath,
        mime: e.mime ?? null,
        tagsJson: e.tagsJson ?? null,
        caseId: e.caseId ?? null,
      })),
      ...onCase.map((e) => ({
        id: e.id,
        title: e.title,
        filePath: e.filePath,
        mime: e.mime ?? null,
        tagsJson: e.tagsJson ?? null,
        caseId: id as string,
      })),
    ];
    const seen = new Set<string>();
    setFieldLibrary(merged.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true))));
  }

  function toggleFieldPhoto(evidenceId: string) {
    setSelectedFieldIds((prev) =>
      prev.includes(evidenceId) ? prev.filter((x) => x !== evidenceId) : [...prev, evidenceId],
    );
  }

  async function useSelectedFieldPhotos() {
    if (!selectedFieldIds.length) return;
    setBusy(true);
    flash("");
    let ok = 0;
    for (const evidenceId of selectedFieldIds) {
      const res = await fetch(`/api/evidence/${evidenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: id, markAfter: true }),
      });
      if (res.ok) ok += 1;
    }
    setBusy(false);
    if (ok === 0) {
      flash(t("case.pickFieldPhotosFail"), true);
      return;
    }
    flash(t("case.pickFieldPhotosOk", { n: ok }));
    setFieldPickerOpen(false);
    setSelectedFieldIds([]);
    setWaiveOpen(false);
    await load();
  }

  async function deleteCase() {
    if (!item) return;
    if (
      !window.confirm(
        t("case.deleteConfirm", { caseNo: item.caseNo, title: item.title }),
      )
    ) {
      return;
    }
    setBusy(true);
    flash("");
    const res = await fetch(`/api/cases/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      flash(data.error || t("case.deleteFail"), true);
      return;
    }
    router.push("/cases");
    router.refresh();
  }

  async function saveEdit() {
    const title = edit.title.trim();
    if (!title) {
      flash(t("case.needTitle"), true);
      return;
    }
    const ok = await patch({
      title,
      description: edit.description.trim(),
      category: edit.category,
      severity: edit.severity,
      location: edit.location.trim() || t("case.locationPending"),
      recommendation: edit.recommendation.trim() || null,
      dueAt: edit.dueAt || null,
      assigneeId: edit.assigneeId || null,
      subcontractorId: edit.subcontractorId || null,
      eventType: "EDIT",
      eventNote: t("case.editNote"),
    });
    if (ok) {
      setEditing(false);
      setAssign((a) => ({
        ...a,
        assigneeId: edit.assigneeId,
        subcontractorId: edit.subcontractorId,
        dueAt: edit.dueAt,
        instructions: edit.recommendation || a.instructions,
      }));
      flash(t("case.saved"));
    }
  }

  function cancelEdit() {
    if (item) syncEditFromCase(item);
    setEditing(false);
    flash("");
  }

  if (!item) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-sm text-slate-500">{msg || t("case.loading")}</p>
        {msg && (
          <Link href="/cases" className="axon-btn axon-btn-ghost inline-flex">
            {t("case.backList")}
          </Link>
        )}
      </div>
    );
  }

  const remain = daysRemaining(item.dueAt);
  const openDays = Math.max(
    0,
    Math.floor(
      ((item.closedAt ? new Date(item.closedAt).getTime() : Date.now()) -
        new Date(item.discoveredAt).getTime()) /
        86400000,
    ),
  );

  const loop = getCaseLoopState(
    {
      status: item.status,
      assigneeId: item.assigneeId || item.assignee?.id,
      subcontractorId: item.subcontractorId || item.subcontractor?.id,
      evidence: item.evidence.map((e) => ({
        id: e.id,
        createdAt: e.createdAt || item.discoveredAt,
        tagsJson: e.tagsJson,
      })),
      events: item.events,
    },
    locale,
  );
  const descParts = splitSourcePack(item.description);

  function handleLoopAction(action: CaseLoopNextAction) {
    if (action === "assign") {
      setTab("details");
      setTimeout(() => {
        document.getElementById("case-loop-assign")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      return;
    }
    if (action === "after_proof") {
      setTab("details");
      setTimeout(() => {
        document.getElementById("case-loop-close")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      return;
    }
    if (action === "close") {
      setTab("details");
      void tryClose();
      return;
    }
    if (action === "pack") {
      void downloadPack();
    }
  }

  return (
    <div className="space-y-6">
      <input
        ref={afterPhotoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void attachAfterPhotos(e.target.files);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs text-slate-400">{item.caseNo}</div>
          {editing ? (
            <input
              className="mt-1 w-full max-w-2xl rounded-lg border border-slate-200 px-3 py-2 text-xl font-semibold text-[var(--axon-navy)]"
              value={edit.title}
              onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              placeholder={t("case.titlePh")}
            />
          ) : (
            <h1 className="text-2xl font-semibold text-[var(--axon-navy)]">{item.title}</h1>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={cn("rounded px-2 py-0.5", CATEGORY_COLORS[item.category])}>
              {categoryLabels[item.category] || item.category}
            </span>
            <span className={cn("rounded-full px-2 py-0.5", STATUS_COLORS[item.status])}>
              {caseStatusLabels[item.status] || item.status}
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
              {t("case.severityLabel", {
                label: severityLabels[item.severity] || item.severity,
              })}
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
              {t("case.openDays", { n: openDays })}
            </span>
            {remain !== null && item.status !== "CLOSED" && (
              <span
                className={cn(
                  "rounded px-2 py-0.5",
                  remain < 0 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700",
                )}
              >
                {remain < 0
                  ? t("common.overdueDays", { n: Math.abs(remain) })
                  : t("common.remainDaysLong", { n: remain })}
              </span>
            )}
            {afterReady ? (
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">
                {t("case.afterReady")}
              </span>
            ) : (
              item.status !== "CLOSED" && (
                <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800">
                  {t("case.afterMissing")}
                </span>
              )
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!editing ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                syncEditFromCase(item);
                setEditing(true);
                setTab("details");
              }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              {t("case.edit")}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={saveEdit}
                className="rounded-lg bg-[var(--axon-blue)] px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {t("case.save")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={cancelEdit}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
              >
                {t("case.cancel")}
              </button>
            </>
          )}
          <button
            onClick={downloadPack}
            disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            {t("case.pack")}
          </button>
          <button
            onClick={downloadArchive}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            {t("case.downloadAll")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={deleteCase}
            className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            {t("case.delete")}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[var(--axon-navy)]">{t("loop.title")}</h2>
            <p className="text-xs text-slate-500">{caseLoopSubtitle(locale)}</p>
          </div>
        </div>
        <CaseLoopStepper steps={loop.steps} />
        <CaseLoopNextPanel action={loop.nextAction} busy={busy} onAction={handleLoopAction} />
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {(
          [
            ["details", "case.tab.details"],
            ["progress", "case.tab.progress"],
            ["files", "case.tab.files"],
            ["logs", "case.tab.logs"],
          ] as const
        ).map(([k, key]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm",
              tab === k
                ? "border-[var(--axon-blue)] text-[var(--axon-blue)]"
                : "border-transparent text-slate-500",
            )}
          >
            {t(key)}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{t("case.info")}</h2>
              {editing && (
                <span className="text-[11px] font-medium text-[var(--axon-blue)]">
                  {t("case.editing")}
                </span>
              )}
            </div>
            {editing ? (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs text-slate-500">
                    {t("common.category")}
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={edit.category}
                      onChange={(e) => setEdit({ ...edit, category: e.target.value })}
                    >
                      {Object.entries(categoryLabels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-slate-500">
                    {t("common.severity")}
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={edit.severity}
                      onChange={(e) => setEdit({ ...edit, severity: e.target.value })}
                    >
                      {Object.entries(severityLabels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block text-xs text-slate-500">
                  {t("common.location")}
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={edit.location}
                    onChange={(e) => setEdit({ ...edit, location: e.target.value })}
                  />
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs text-slate-500">
                    {t("common.assignee")}
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={edit.assigneeId}
                      onChange={(e) => setEdit({ ...edit, assigneeId: e.target.value })}
                    >
                      <option value="">{t("common.unassigned")}</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-slate-500">
                    {t("common.subcontractor")}
                    <select
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      value={edit.subcontractorId}
                      onChange={(e) => setEdit({ ...edit, subcontractorId: e.target.value })}
                    >
                      <option value="">{t("common.unspecified")}</option>
                      {subs.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block text-xs text-slate-500">
                  {t("common.due")}
                  <input
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={edit.dueAt}
                    onChange={(e) => setEdit({ ...edit, dueAt: e.target.value })}
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  {t("common.description")}
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    rows={4}
                    value={edit.description}
                    onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                  />
                </label>
                <label className="block text-xs text-slate-500">
                  {t("case.recommendation")}
                  <textarea
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    rows={3}
                    value={edit.recommendation}
                    onChange={(e) => setEdit({ ...edit, recommendation: e.target.value })}
                  />
                </label>
                <p className="text-xs text-slate-400">
                  {t("case.discoveredFixed", { date: formatDate(item.discoveredAt) })}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={saveEdit}
                    className="rounded-lg bg-[var(--axon-blue)] px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {t("case.saveEdit")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={cancelEdit}
                    className="rounded-lg border px-4 py-2 text-sm"
                  >
                    {t("case.cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">{t("common.location")}</dt>
                    <dd>{item.location}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">{t("common.discoveredAt")}</dt>
                    <dd>{formatDate(item.discoveredAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">{t("common.assignee")}</dt>
                    <dd>{item.assignee?.name || t("common.none")}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">{t("common.subcontractor")}</dt>
                    <dd>{item.subcontractor?.name || t("common.none")}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">{t("case.project")}</dt>
                    <dd>{item.project.name}</dd>
                  </div>
                </dl>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                  {descParts.summary}
                </p>
                {item.recommendation && (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
                    {t("case.recPrefix", { text: item.recommendation })}
                  </p>
                )}
                {descParts.source && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {t("case.sourcePack")}
                    </div>
                    <div className="mt-2 text-sm leading-relaxed text-slate-700">
                      <LinkedSource text={descParts.source} />
                    </div>
                  </div>
                )}
              </>
            )}
          </section>

          <section id="case-loop-assign" className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold">{t("case.step2")}</h2>
            <div className="space-y-3">
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={assign.subcontractorId}
                onChange={(e) => setAssign({ ...assign, subcontractorId: e.target.value })}
              >
                <option value="">{t("case.pickSub")}</option>
                {subs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={assign.assigneeId}
                onChange={(e) => setAssign({ ...assign, assigneeId: e.target.value })}
              >
                <option value="">{t("case.pickAssignee")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={assign.dueAt}
                onChange={(e) => setAssign({ ...assign, dueAt: e.target.value })}
              />
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={3}
                placeholder={t("case.instructionsPh")}
                value={assign.instructions}
                onChange={(e) => setAssign({ ...assign, instructions: e.target.value })}
              />
              <button
                disabled={busy}
                onClick={() =>
                  patch({
                    status: "ASSIGNED",
                    eventType: "ASSIGN",
                    eventNote: t("case.assignNote"),
                    subcontractorId: assign.subcontractorId || null,
                    assigneeId: assign.assigneeId || null,
                    dueAt: assign.dueAt || null,
                    instructions: assign.instructions,
                  })
                }
                className="w-full rounded-lg bg-[var(--axon-blue)] py-2 text-sm text-white disabled:opacity-50"
              >
                {t("case.sendAssign")}
              </button>
            </div>
          </section>

          <section id="case-loop-close" className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold">{t("case.step4")}</h2>
            <p className="mb-3 text-xs text-slate-500">{t("case.step4Hint")}</p>
            {afterPhotos.length > 0 && (
              <div className="mb-3">
                <p className="mb-2 text-xs font-medium text-emerald-700">
                  {t("case.attachAfterCount", { n: afterPhotos.length })}
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                  {afterPhotos.map((e) => {
                    const href = mediaUrl(e.filePath);
                    const image = Boolean(e.mime?.startsWith("image/") && href);
                    return (
                      <Link
                        key={e.id}
                        href={`/evidence?id=${e.id}`}
                        className="overflow-hidden rounded-lg border border-emerald-100 bg-slate-50"
                      >
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={href!} alt="" className="h-20 w-full object-cover" />
                        ) : (
                          <div className="flex h-20 items-center justify-center px-1 text-center text-[10px] text-slate-500">
                            {e.title}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="mb-2 text-xs text-slate-400">{t("case.attachAfterHint")}</p>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || item.status === "CLOSED"}
                onClick={() => afterPhotoInputRef.current?.click()}
                className="rounded-lg border border-[var(--axon-blue)] bg-[var(--axon-blue)]/5 px-3 py-2 text-sm text-[var(--axon-blue)] disabled:opacity-50"
              >
                {t("case.attachAfter")}
              </button>
              <button
                type="button"
                disabled={busy || item.status === "CLOSED"}
                onClick={() => void openFieldPhotoPicker()}
                className="rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 disabled:opacity-50"
              >
                {t("case.pickFieldPhotos")}
              </button>
              {fieldPickerOpen && (
                <button
                  type="button"
                  onClick={() => setFieldPickerOpen(false)}
                  className="rounded-lg border px-3 py-2 text-sm text-slate-600"
                >
                  {t("case.pickFieldPhotosClose")}
                </button>
              )}
            </div>
            {fieldPickerOpen && (
              <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                <p className="mb-2 text-xs text-slate-600">{t("case.pickFieldPhotosHint")}</p>
                {fieldLibraryLoading ? (
                  <p className="py-6 text-center text-sm text-slate-500">{t("case.pickFieldPhotosLoading")}</p>
                ) : fieldLibrary.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">{t("case.pickFieldPhotosEmpty")}</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                      {fieldLibrary.map((e) => {
                        const href = mediaUrl(e.filePath);
                        const image = Boolean(e.mime?.startsWith("image/") && href);
                        const selected = selectedFieldIds.includes(e.id);
                        const fieldShot = tagsIncludeFieldCompletion(e.tagsJson);
                        return (
                          <button
                            key={e.id}
                            type="button"
                            disabled={busy}
                            onClick={() => toggleFieldPhoto(e.id)}
                            className={cn(
                              "relative overflow-hidden rounded-lg border bg-white text-left",
                              selected
                                ? "border-emerald-600 ring-2 ring-emerald-500/40"
                                : "border-slate-200",
                            )}
                          >
                            {image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={href!} alt="" className="h-20 w-full object-cover" />
                            ) : (
                              <div className="flex h-20 items-center justify-center px-1 text-center text-[10px] text-slate-500">
                                {e.title}
                              </div>
                            )}
                            {fieldShot && (
                              <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] text-white">
                                {t("case.fieldShotBadge")}
                              </span>
                            )}
                            {selected && (
                              <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      disabled={busy || selectedFieldIds.length === 0}
                      onClick={() => void useSelectedFieldPhotos()}
                      className="mt-3 w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {t("case.pickFieldPhotosUse", { n: selectedFieldIds.length })}
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy}
                onClick={() =>
                  patch({
                    status: "IN_PROGRESS",
                    eventType: "PROGRESS",
                    eventNote: t("case.progressStart"),
                  })
                }
                className="rounded-lg border px-3 py-2 text-sm"
              >
                {t("case.markProgress")}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  patch({
                    status: "PENDING_REVIEW",
                    eventType: "REVIEW",
                    eventNote: t("case.reviewNote"),
                  })
                }
                className="rounded-lg border px-3 py-2 text-sm"
              >
                {t("case.submitReview")}
              </button>
              <button
                disabled={busy || item.status === "CLOSED"}
                onClick={tryClose}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {t("case.closePass")}
              </button>
              <button
                disabled={busy}
                onClick={downloadPack}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              >
                {t("case.downloadPack")}
              </button>
            </div>
            {waiveOpen && item.status !== "CLOSED" && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-900">{t("case.waiveHint")}</p>
                <textarea
                  className="mt-2 w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
                  rows={2}
                  placeholder={t("case.waivePh")}
                  value={waiveNote}
                  onChange={(e) => setWaiveNote(e.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={confirmWaiveClose}
                    className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs text-white"
                  >
                    {t("case.waiveClose")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => afterPhotoInputRef.current?.click()}
                    className="rounded-lg border border-[var(--axon-blue)] px-3 py-1.5 text-xs text-[var(--axon-blue)]"
                  >
                    {t("case.attachAfter")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWaiveOpen(false);
                      setTab("files");
                    }}
                    className="rounded-lg border px-3 py-1.5 text-xs"
                  >
                    {t("case.goFiles")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaiveOpen(false)}
                    className="rounded-lg px-3 py-1.5 text-xs text-slate-500"
                  >
                    {t("case.cancel")}
                  </button>
                </div>
              </div>
            )}
            {msg && (
              <p className={cn("mt-2 text-sm", msgErr ? "text-rose-600" : "text-emerald-600")}>
                {msg}
              </p>
            )}
          </section>
        </div>
      )}

      {tab === "progress" && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <Timeline events={item.events} />
        </section>
      )}

      {tab === "files" && (
        <section className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <h2 className="text-sm font-semibold">{t("case.step3")}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {afterReady ? t("case.step3Ready") : t("case.step3Need")}
            </p>
            <button
              type="button"
              disabled={busy || item.status === "CLOSED"}
              onClick={() => afterPhotoInputRef.current?.click()}
              className="mt-2 rounded-lg border border-[var(--axon-blue)] bg-[var(--axon-blue)]/5 px-3 py-1.5 text-xs text-[var(--axon-blue)] disabled:opacity-50"
            >
              {t("case.attachAfter")}
            </button>
            <button
              type="button"
              disabled={busy || item.status === "CLOSED"}
              onClick={() => {
                setTab("details");
                void openFieldPhotoPicker();
                setTimeout(() => {
                  document.getElementById("case-loop-close")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }, 50);
              }}
              className="ml-2 mt-2 rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800 disabled:opacity-50"
            >
              {t("case.pickFieldPhotos")}
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {item.evidence.map((e) => {
            const href = mediaUrl(e.filePath);
            const image = Boolean(e.mime?.startsWith("image/") && href);
            const isAfter = tagsIncludeAfter(e.tagsJson);
            const tags = parseEvidenceTags(e.tagsJson);
            return (
              <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-3">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={href!} alt="" className="mb-2 h-36 w-full rounded-lg object-cover bg-slate-100" />
                ) : (
                  <div className="mb-2 flex h-36 flex-col items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 text-center text-xs text-slate-500">
                    <span>
                      {e.type === "CHAT"
                        ? t("case.sourcePack")
                        : e.mime || e.type}
                    </span>
                    {href && e.type !== "CHAT" && (
                      <a href={href} target="_blank" rel="noreferrer" className="text-[var(--axon-blue)]">
                        {t("case.openFile")}
                      </a>
                    )}
                  </div>
                )}
                <div className="text-sm font-medium">{e.title}</div>
                {tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tags.map((tag) => (
                      <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                {e.chatText && (
                  <div className="mt-1 text-xs leading-relaxed text-slate-600">
                    <LinkedSource text={e.chatText} />
                  </div>
                )}
                {isAfter ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700">{t("case.markedAfter")}</p>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => markAfter(e.id)}
                    className="mt-2 text-xs font-medium text-[var(--axon-blue)] hover:underline"
                  >
                    {t("case.markAfter")}
                  </button>
                )}
                <Link
                  href={`/evidence?id=${e.id}`}
                  className="mt-2 block text-xs text-slate-500 hover:text-[var(--axon-blue)] hover:underline"
                >
                  {t("case.openInEvidence")}
                </Link>
              </div>
            );
          })}
          {item.evidence.length === 0 && (
            <p className="text-sm text-slate-400">{t("case.noFiles")}</p>
          )}
          </div>
        </section>
      )}

      {tab === "logs" && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold">{t("case.tasks")}</h2>
          <ul className="mb-6 space-y-2">
            {item.tasks.map((task) => (
              <li key={task.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                {task.title}
                <span className="ml-2 text-xs text-slate-400">{task.status}</span>
              </li>
            ))}
          </ul>
          <Timeline events={item.events} />
        </section>
      )}
    </div>
  );
}
