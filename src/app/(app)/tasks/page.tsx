"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignLeft,
  Archive,
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  Link2,
  Maximize2,
  MessageSquare,
  Minimize2,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { mediaUrl, isProbablyImage } from "@/lib/media";
import { STATUS_COLORS, cn, daysRemaining, formatDay } from "@/lib/labels";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, asArray } from "@/lib/api-client";
import { type MinutesOutputLang, type MinutesProgress, takeMinutesPreview, uploadMinutesPreview, repreviewMinutesText } from "@/lib/file-base64";
import { MinutesProgressOverlay } from "@/components/MinutesProgressOverlay";
import { MinutesLangSwitch, MinutesUploadGroup } from "@/components/MinutesLangSwitch";
import {
  COLUMN_THEME,
  TASK_COLUMNS,
  TASK_LABELS,
  initials,
  labelMeta,
  parseChecklist,
  parseLabels,
  type TaskCheckItem,
  type TaskColumnId,
} from "@/lib/task-board";

type TaskAttachment = {
  id: string;
  name: string;
  filePath?: string | null;
  url?: string | null;
  mime?: string | null;
  size?: number;
  isCover?: boolean;
};

type TaskComment = {
  id: string;
  body: string;
  createdAt: string;
  actor?: { id: string; name: string } | null;
};

type Task = {
  id: string;
  title: string;
  instructions: string | null;
  status: string;
  dueAt: string | null;
  sortOrder?: number;
  labelsJson?: string | null;
  coverColor?: string | null;
  checklistJson?: string | null;
  archived?: boolean;
  caseId?: string | null;
  meetingId?: string | null;
  case?: { id: string; caseNo: string; title: string } | null;
  meeting?: { id: string; title: string; meetingAt?: string | null } | null;
  assignee?: { id?: string; name: string } | null;
  attachments?: TaskAttachment[];
  comments?: TaskComment[];
};

type Meeting = {
  id: string;
  title: string;
  meetingAt: string | null;
  sourceName?: string | null;
  sortOrder?: number;
  _count?: { tasks: number };
};

type CaseOpt = { id: string; caseNo: string; title: string };
type UserOpt = { id: string; name: string };

type PreviewAction = {
  title: string;
  assigneeName: string | null;
  assigneeId: string | null;
  matchedName?: string | null;
  dueAt: string | null;
  notes: string | null;
};

type MinutesPreview = {
  title: string;
  meetingAt: string | null;
  sourceName: string;
  rawText: string;
  actions: PreviewAction[];
  outputLang?: MinutesOutputLang;
  mock?: boolean;
};

function meetingDropId(id: string) {
  return `meeting:${id}`;
}

function parseMeetingDropId(id: string) {
  return id.startsWith("meeting:") ? id.slice("meeting:".length) : null;
}

/** Case-status board move only (never mixes with meeting cards). */
function applyCaseMove(list: Task[], activeCardId: string, overId: string): Task[] {
  const from = list.find((t) => t.id === activeCardId);
  if (!from || from.meetingId) return list;
  const overMeeting = parseMeetingDropId(overId);
  if (overMeeting) return list;
  const overIsColumn = TASK_COLUMNS.includes(overId as TaskColumnId);
  const overTask = list.find((t) => t.id === overId);
  if (overTask?.meetingId) return list;
  const nextStatus = overIsColumn
    ? (overId as TaskColumnId)
    : ((overTask?.status || from.status) as TaskColumnId);
  const without = list.filter((t) => t.id !== activeCardId);
  const target = without
    .filter((t) => !t.meetingId && t.status === nextStatus)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  let index = target.length;
  if (overTask && !overTask.meetingId && overTask.status === nextStatus) {
    index = target.findIndex((t) => t.id === overTask.id);
    if (index < 0) index = target.length;
  }
  target.splice(index, 0, { ...from, status: nextStatus });
  const reindexed = target.map((t, i) => ({ ...t, sortOrder: i }));
  return [...without.filter((t) => t.meetingId || t.status !== nextStatus), ...reindexed];
}

/** Reorder only inside the same meeting list. */
function applyMeetingMove(list: Task[], activeCardId: string, overId: string): Task[] {
  const from = list.find((t) => t.id === activeCardId);
  if (!from?.meetingId) return list;
  const dropMeeting = parseMeetingDropId(overId);
  const overTask = list.find((t) => t.id === overId);
  const meetingId = dropMeeting || overTask?.meetingId;
  if (!meetingId || meetingId !== from.meetingId) return list;

  const without = list.filter((t) => t.id !== activeCardId);
  const target = without
    .filter((t) => t.meetingId === meetingId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  let index = target.length;
  if (overTask && overTask.meetingId === meetingId) {
    index = target.findIndex((t) => t.id === overTask.id);
    if (index < 0) index = target.length;
  }
  target.splice(index, 0, from);
  const reindexed = target.map((t, i) => ({ ...t, sortOrder: i }));
  return [...without.filter((t) => t.meetingId !== meetingId), ...reindexed];
}

function applyMove(list: Task[], activeCardId: string, overId: string): Task[] {
  const from = list.find((t) => t.id === activeCardId);
  if (!from) return list;
  if (from.meetingId) return applyMeetingMove(list, activeCardId, overId);
  return applyCaseMove(list, activeCardId, overId);
}

function dueTone(task: Task) {
  const remain = daysRemaining(task.dueAt);
  if (remain === null) return "";
  if (task.status === "DONE") return "bg-emerald-100 text-emerald-800";
  if (remain < 0) return "bg-rose-100 text-rose-700";
  if (remain <= 2) return "bg-amber-100 text-amber-800";
  return "bg-sky-100 text-sky-800";
}

function coverImage(task: Task) {
  const att = task.attachments?.find((a) => a.isCover && isImageAttachment(a) && a.filePath);
  return att ? mediaUrl(att.filePath) : null;
}

function attachmentSrc(a: TaskAttachment) {
  return a.url || mediaUrl(a.filePath);
}

function isImageAttachment(a: TaskAttachment) {
  return isProbablyImage({ type: a.mime || undefined, name: a.name });
}

function isPdfAttachment(a: TaskAttachment) {
  return (a.mime || "").includes("pdf") || /\.pdf$/i.test(a.name) || /\.pdf($|\?)/i.test(a.url || "");
}

function isVideoAttachment(a: TaskAttachment) {
  return (a.mime || "").startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(a.name);
}

function isAudioAttachment(a: TaskAttachment) {
  return (a.mime || "").startsWith("audio/") || /\.(mp3|wav|webm|m4a|ogg)$/i.test(a.name);
}

function TaskCardFace({ task, muted }: { task: Task; muted?: boolean }) {
  const { t } = useI18n();
  const labels = parseLabels(task.labelsJson);
  const checks = parseChecklist(task.checklistJson);
  const done = checks.filter((c) => c.checked).length;
  const cover = labelMeta(task.coverColor || "");
  const coverSrc = coverImage(task);
  const remain = daysRemaining(task.dueAt);
  const overdue = remain !== null && remain < 0 && task.status !== "DONE";
  const badge = task.meetingId
    ? t("tasks.meeting")
    : task.case?.caseNo || t("common.none");
  const fileCount = task.attachments?.length || 0;
  const commentCount = task.comments?.length || 0;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5",
        muted && "opacity-70",
        overdue && "ring-rose-300",
      )}
    >
      {coverSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverSrc} alt="" className="h-24 w-full object-cover" />
      ) : (
        cover && <div className="h-8 w-full" style={{ background: cover.hex }} />
      )}
      <div className="space-y-2 p-3">
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {labels.map((id) => {
              const meta = labelMeta(id);
              if (!meta) return null;
              return (
                <span
                  key={id}
                  title={meta.name}
                  className="h-2 w-10 rounded-sm"
                  style={{ background: meta.hex }}
                />
              );
            })}
          </div>
        )}
        <div className="text-sm font-medium leading-snug text-slate-800">{task.title}</div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          {task.instructions && <AlignLeft size={12} />}
          {checks.length > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <CheckSquare size={12} />
              {done}/{checks.length}
            </span>
          )}
          {fileCount > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Paperclip size={12} />
              {fileCount}
            </span>
          )}
          {commentCount > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <MessageSquare size={12} />
              {commentCount}
            </span>
          )}
          {task.dueAt && (
            <span className={cn("inline-flex items-center gap-0.5 rounded px-1.5 py-0.5", dueTone(task))}>
              <Calendar size={11} />
              {formatDay(task.dueAt)}
            </span>
          )}
          <span
            className={cn(
              "rounded px-1.5 py-0.5",
              task.meetingId ? "bg-purple-100 text-purple-800" : "bg-slate-100",
            )}
          >
            {badge}
          </span>
          {task.assignee?.name && (
            <span
              title={task.assignee.name}
              className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-[#0079bf] text-[10px] font-semibold text-white"
            >
              {initials(task.assignee.name)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function SortableCard({
  task,
  onOpen,
  suppressOpen,
}: {
  task: Task;
  onOpen: (task: Task) => void;
  suppressOpen: () => boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: {
      type: "card",
      status: task.status,
      meetingId: task.meetingId || null,
    },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("cursor-grab touch-none active:cursor-grabbing", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging && !suppressOpen()) onOpen(task);
      }}
    >
      <TaskCardFace task={task} />
    </div>
  );
}

function ColumnDrop({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: "column", id } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[120px] flex-1 space-y-2 rounded-lg p-1 transition",
        isOver && "bg-white/70",
      )}
    >
      {children}
    </div>
  );
}

export default function TasksPage() {
  const { t, taskStatusLabels } = useI18n();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [archived, setArchived] = useState<Task[]>([]);
  const [cases, setCases] = useState<CaseOpt[]>([]);
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [view, setView] = useState<"board" | "list">("board");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState<Task | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [composer, setComposer] = useState<TaskColumnId | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftCaseId, setDraftCaseId] = useState("");
  const [preview, setPreview] = useState<MinutesPreview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<MinutesProgress | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [minutesLang, setMinutesLang] = useState<MinutesOutputLang>("original");
  const [menuMeetingId, setMenuMeetingId] = useState<string | null>(null);
  const [focusMeetingId, setFocusMeetingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const justDragged = useRef(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function load() {
    const [taskRes, archRes, caseRes, settingsRes, meetingRes] = await Promise.all([
      apiFetch<Task[]>("/api/tasks"),
      apiFetch<Task[]>("/api/tasks?archived=1"),
      apiFetch<CaseOpt[]>("/api/cases"),
      apiFetch<{ users?: UserOpt[] }>("/api/settings"),
      apiFetch<Meeting[]>("/api/meetings"),
    ]);
    if (!taskRes.ok) {
      setTasks([]);
      setError(taskRes.error);
    } else {
      setTasks(asArray<Task>(taskRes.data));
      setError("");
      setOpen((prev) => {
        if (!prev) return prev;
        return asArray<Task>(taskRes.data).find((t) => t.id === prev.id) || prev;
      });
    }
    setArchived(archRes.ok ? asArray<Task>(archRes.data) : []);
    setMeetings(meetingRes.ok ? asArray<Meeting>(meetingRes.data) : []);
    if (caseRes.ok) {
      const rows = asArray<CaseOpt>(caseRes.data).map((c) => ({
        id: c.id,
        caseNo: c.caseNo,
        title: c.title,
      }));
      setCases(rows);
      setDraftCaseId((prev) => prev || rows[0]?.id || "");
    }
    if (settingsRes.ok) setUsers(settingsRes.data?.users || []);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wantPreview =
      params.get("minutesPreview") === "1" || params.get("minutesPreview") === "true";
    if (!wantPreview) return;
    const stashed = takeMinutesPreview();
    if (stashed) {
      const lang = stashed.outputLang || "original";
      setMinutesLang(lang);
      setPreview({
        title: stashed.title,
        meetingAt: stashed.meetingAt,
        sourceName: stashed.sourceName,
        rawText: stashed.rawText,
        actions: stashed.actions || [],
        outputLang: lang,
        mock: stashed.mock,
      });
    }
    router.replace("/tasks", { scroll: false });
  }, [router]);

  useEffect(() => {
    if (!focusMeetingId) return;
    const el = document.getElementById(`meeting-${focusMeetingId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
    setFocusMeetingId(null);
  }, [focusMeetingId, meetings]);

  const visible = useMemo(() => {
    return tasks.filter((t) => {
      const q = query.trim().toLowerCase();
      if (
        q &&
        !`${t.title} ${t.case?.caseNo || ""} ${t.meeting?.title || ""} ${t.assignee?.name || ""}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      if (labelFilter && !parseLabels(t.labelsJson).includes(labelFilter)) return false;
      return true;
    });
  }, [tasks, query, labelFilter]);

  const caseVisible = useMemo(() => visible.filter((t) => !t.meetingId), [visible]);
  const activeTask = tasks.find((t) => t.id === activeId) || null;

  const agingMinutes = useMemo(() => {
    const now = Date.now();
    return tasks.filter(
      (t) =>
        t.meetingId &&
        !t.archived &&
        t.status !== "DONE" &&
        t.dueAt &&
        new Date(t.dueAt).getTime() < now,
    ).length;
  }, [tasks]);

  function columnTasks(col: string) {
    return caseVisible
      .filter((t) => t.status === col)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  function meetingTasks(meetingId: string) {
    return visible
      .filter((t) => t.meetingId === meetingId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  async function persistOrder(next: Task[]) {
    const caseReorder = TASK_COLUMNS.flatMap((col) =>
      next
        .filter((t) => !t.meetingId && t.status === col)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((t, i) => ({ id: t.id, status: t.status, sortOrder: i })),
    );
    const meetingReorder = meetings.flatMap((m) =>
      next
        .filter((t) => t.meetingId === m.id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((t, i) => ({
          id: t.id,
          status: t.status,
          sortOrder: i,
          meetingId: m.id,
        })),
    );
    await apiFetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorder: [...caseReorder, ...meetingReorder] }),
    });
  }

  function onDragStart(e: DragStartEvent) {
    justDragged.current = true;
    setActiveId(String(e.active.id));
  }

  function onDragOver(e: DragOverEvent) {
    const overId = e.over?.id ? String(e.over.id) : "";
    const activeCardId = String(e.active.id);
    if (!overId || overId === activeCardId) return;
    const from = tasks.find((t) => t.id === activeCardId);
    if (!from) return;
    if (from.meetingId) {
      const overTask = tasks.find((t) => t.id === overId);
      const dropMeeting = parseMeetingDropId(overId);
      if (dropMeeting === from.meetingId || overTask?.meetingId === from.meetingId) {
        setTasks((prev) => applyMove(prev, activeCardId, overId));
      }
      return;
    }
    const overIsColumn = TASK_COLUMNS.includes(overId as TaskColumnId);
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask?.meetingId || parseMeetingDropId(overId)) return;
    const nextStatus = overIsColumn ? overId : overTask?.status;
    if (nextStatus && nextStatus !== from.status) {
      setTasks((prev) => applyMove(prev, activeCardId, overId));
    }
  }

  async function onDragEnd(e: DragEndEvent) {
    const overId = e.over?.id ? String(e.over.id) : "";
    const activeCardId = String(e.active.id);
    setActiveId(null);
    window.setTimeout(() => {
      justDragged.current = false;
    }, 80);
    if (!overId || overId === activeCardId) return;
    let next: Task[] = tasks;
    setTasks((prev) => {
      next = applyMove(prev, activeCardId, overId);
      return next;
    });
    await persistOrder(next);
  }

  async function saveTask(id: string, patch: Record<string, unknown>) {
    const res = await apiFetch<Task>("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (!res.ok) return;
    if (patch.delete === true || patch.archived === true) {
      setOpen(null);
      await load();
      return;
    }
    if (res.data) {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...res.data } : t)));
      setOpen((prev) => (prev?.id === id ? { ...prev, ...res.data } : prev));
    }
  }

  async function copyTask(id: string) {
    const res = await apiFetch<Task>("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copyFrom: id }),
    });
    if (!res.ok) {
      setError(res.error || t("tasks.copyFail"));
      return;
    }
    await load();
    setOpen(res.data);
  }

  async function addCard(status: TaskColumnId) {
    if (!draftTitle.trim() || !draftCaseId) return;
    const res = await apiFetch<Task>("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: draftTitle.trim(), caseId: draftCaseId, status }),
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDraftTitle("");
    setComposer(null);
    await load();
  }

  async function onPickMinutes(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError("");
    setUploadProgress({ pct: 4, label: t("inbox.startProcess") });
    try {
      const data = await uploadMinutesPreview(file, setUploadProgress, {
        outputLang: minutesLang,
      });
      setUploadProgress({ pct: 100, label: t("common.done") });
      await new Promise((r) => setTimeout(r, 280));
      setPreview({
        title: data.title,
        meetingAt: data.meetingAt,
        sourceName: data.sourceName,
        rawText: data.rawText,
        actions: data.actions || [],
        outputLang: data.outputLang || minutesLang,
        mock: data.mock,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("tasks.uploadFail"));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function confirmMinutes() {
    if (!preview || preview.actions.length === 0) return;
    setConfirming(true);
    const res = await apiFetch<Meeting>("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm: true,
        title: preview.title,
        meetingAt: preview.meetingAt,
        sourceName: preview.sourceName,
        rawText: preview.rawText,
        actions: preview.actions,
      }),
    });
    setConfirming(false);
    if (!res.ok) {
      setError(res.error || t("tasks.createFail"));
      return;
    }
    setPreview(null);
    await load();
    if (res.data?.id) setFocusMeetingId(res.data.id);
  }

  async function renameMeeting(id: string) {
    const current = meetings.find((m) => m.id === id);
    const next = window.prompt(t("tasks.listName"), current?.title || "");
    if (!next?.trim()) return;
    await apiFetch(`/api/meetings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: next.trim() }),
    });
    setMenuMeetingId(null);
    await load();
  }

  async function deleteMeeting(id: string) {
    if (!window.confirm(t("tasks.deleteListConfirm"))) return;
    await apiFetch(`/api/meetings/${id}`, { method: "DELETE" });
    setMenuMeetingId(null);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="axon-title text-2xl font-semibold">{t("tasks.title")}</h1>
          <p className="text-sm axon-muted">
            {t("tasks.subtitle")}
          </p>
          {agingMinutes > 0 && (
            <p className="mt-1 text-xs font-medium text-rose-700">
              {t("tasks.overdueActions", { n: agingMinutes })}
            </p>
          )}
          {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
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
            disabled={uploading}
          >
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="axon-btn axon-btn-primary min-h-8 px-3 text-sm"
            >
              <FileUp size={14} />
              {uploading ? t("common.processing") : t("common.upload")}
            </button>
          </MinutesUploadGroup>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
            <input
              className="axon-input h-9 min-h-0 w-44 pl-8 text-sm"
              placeholder={t("tasks.searchCards")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowArchive(true)}
            className="axon-btn axon-btn-ghost min-h-9 px-3 text-sm"
          >
            <Archive size={14} />
            {t("tasks.archive")} {archived.length}
          </button>
          <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-[var(--axon-line)]">
            <button
              onClick={() => setView("board")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                view === "board" ? "bg-[var(--axon-brand)] text-white" : "text-slate-600",
              )}
            >
              {t("tasks.viewBoard")}
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                view === "list" ? "bg-[var(--axon-brand)] text-white" : "text-slate-600",
              )}
            >
              {t("tasks.viewList")}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TASK_LABELS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setLabelFilter((cur) => (cur === l.id ? null : l.id))}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium text-white shadow-sm",
              labelFilter === l.id ? "ring-2 ring-offset-1 ring-slate-700" : "opacity-80 hover:opacity-100",
            )}
            style={{ background: l.hex }}
          >
            {l.name}
          </button>
        ))}
        {labelFilter && (
          <button type="button" onClick={() => setLabelFilter(null)} className="text-xs text-slate-500">
            {t("tasks.clearFilter")}
          </button>
        )}
      </div>

      {view === "board" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <div className="-mx-4 overflow-x-auto pb-4 sm:-mx-6 md:-mx-8">
            <div className="flex min-w-max gap-3 px-4 sm:px-6 md:px-8">
              {TASK_COLUMNS.map((col) => {
                const theme = COLUMN_THEME[col];
                const rows = columnTasks(col);
                return (
                  <section
                    key={col}
                    className="flex w-[280px] shrink-0 flex-col rounded-xl p-2 shadow-sm"
                    style={{ background: theme.bg }}
                  >
                    <div className="mb-2 flex items-center gap-2 px-1 py-1">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: theme.bar }} />
                      <h2 className="text-sm font-semibold" style={{ color: theme.ink }}>
                        {taskStatusLabels[col] || theme.name}
                      </h2>
                      <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-slate-500">
                        {rows.length}
                      </span>
                    </div>
                    <SortableContext items={rows.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                      <ColumnDrop id={col}>
                        {rows.map((t) => (
                          <SortableCard
                            key={t.id}
                            task={t}
                            onOpen={setOpen}
                            suppressOpen={() => justDragged.current}
                          />
                        ))}
                      </ColumnDrop>
                    </SortableContext>
                    {composer === col ? (
                      <div className="mt-1 space-y-2 rounded-lg bg-white p-2 shadow-sm">
                        <input
                          autoFocus
                          className="axon-input min-h-0 py-2 text-sm"
                          placeholder={t("tasks.cardTitlePh")}
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") addCard(col);
                            if (e.key === "Escape") setComposer(null);
                          }}
                        />
                        <select
                          className="axon-input min-h-0 py-2 text-xs"
                          value={draftCaseId}
                          onChange={(e) => setDraftCaseId(e.target.value)}
                        >
                          {cases.length === 0 && <option value="">{t("tasks.noCaseLink")}</option>}
                          {cases.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.caseNo} · {c.title}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => addCard(col)}
                            className="axon-btn axon-btn-primary min-h-8 flex-1 px-3 text-xs"
                          >
                            {t("tasks.addCard")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setComposer(null)}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setComposer(col)}
                        className="mt-1 flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-slate-600 hover:bg-white/70"
                      >
                        <Plus size={14} />
                        {t("tasks.addCard")}
                      </button>
                    )}
                  </section>
                );
              })}

              {meetings.length > 0 && (
                <div className="mx-1 flex w-6 shrink-0 flex-col items-center justify-center">
                  <div className="h-full w-px bg-purple-300/80" />
                </div>
              )}

              {meetings.map((m) => {
                const rows = meetingTasks(m.id);
                return (
                  <section
                    key={m.id}
                    id={`meeting-${m.id}`}
                    className="flex w-[280px] shrink-0 flex-col rounded-xl bg-[#f3e8ff] p-2 shadow-sm ring-1 ring-purple-200/60"
                  >
                    <div className="mb-2 flex items-start gap-2 px-1 py-1">
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#c377e0]" />
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-sm font-semibold text-purple-900">{m.title}</h2>
                        <p className="text-[10px] text-purple-700/80">
                          {t("tasks.meetingList")}
                          {m.meetingAt ? ` · ${formatDay(m.meetingAt)}` : ""}
                        </p>
                      </div>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-slate-500">
                        {rows.length}
                      </span>
                      <div className="relative">
                        <button
                          type="button"
                          className="rounded p-1 text-purple-700 hover:bg-white/70"
                          onClick={() =>
                            setMenuMeetingId((cur) => (cur === m.id ? null : m.id))
                          }
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {menuMeetingId === m.id && (
                          <div className="absolute right-0 z-20 mt-1 w-32 overflow-hidden rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-slate-200">
                            <button
                              type="button"
                              className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                              onClick={() => renameMeeting(m.id)}
                            >
                              {t("tasks.renameList")}
                            </button>
                            <button
                              type="button"
                              className="block w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50"
                              onClick={() => deleteMeeting(m.id)}
                            >
                              {t("tasks.deleteList")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <SortableContext items={rows.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                      <ColumnDrop id={meetingDropId(m.id)}>
                        {rows.map((t) => (
                          <SortableCard
                            key={t.id}
                            task={t}
                            onOpen={setOpen}
                            suppressOpen={() => justDragged.current}
                          />
                        ))}
                      </ColumnDrop>
                    </SortableContext>
                    <button
                      type="button"
                      onClick={async () => {
                        const title = window.prompt(t("tasks.newAction"));
                        if (!title?.trim()) return;
                        await apiFetch("/api/tasks", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            title: title.trim(),
                            meetingId: m.id,
                            labelsJson: JSON.stringify(["purple"]),
                            coverColor: "purple",
                          }),
                        });
                        await load();
                      }}
                      className="mt-1 flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-purple-800 hover:bg-white/70"
                    >
                      <Plus size={14} />
                      {t("tasks.addCard")}
                    </button>
                  </section>
                );
              })}
            </div>
          </div>
          <DragOverlay>{activeTask ? <TaskCardFace task={activeTask} /> : null}</DragOverlay>
        </DndContext>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3">{t("tasks.col.task")}</th>
                <th className="px-4 py-3">{t("tasks.col.source")}</th>
                <th className="px-4 py-3">{t("tasks.col.assignee")}</th>
                <th className="px-4 py-3">{t("tasks.col.due")}</th>
                <th className="px-4 py-3">{t("tasks.col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer border-t hover:bg-slate-50"
                  onClick={() => setOpen(row)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {parseLabels(row.labelsJson)
                        .slice(0, 3)
                        .map((id) => {
                          const meta = labelMeta(id);
                          return meta ? (
                            <span
                              key={id}
                              className="h-2 w-2 rounded-full"
                              style={{ background: meta.hex }}
                            />
                          ) : null;
                        })}
                      {row.title}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {row.case ? (
                      <Link
                        href={`/cases/${row.case.id}`}
                        className="text-[var(--axon-blue)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.case.caseNo}
                      </Link>
                    ) : (
                      <span className="text-purple-700">{row.meeting?.title || t("tasks.meeting")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{row.assignee?.name || t("common.none")}</td>
                  <td className="px-4 py-3">{row.dueAt ? formatDay(row.dueAt) : t("common.none")}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS_COLORS[row.status])}>
                      {taskStatusLabels[row.status] || row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <CardModal
          task={open}
          users={users}
          onClose={() => setOpen(null)}
          onSave={saveTask}
          onCopy={copyTask}
          onReload={load}
        />
      )}

      {uploadProgress && <MinutesProgressOverlay progress={uploadProgress} />}

      {preview && (
        <MinutesPreviewModal
          preview={preview}
          users={users}
          confirming={confirming}
          onChange={setPreview}
          onClose={() => setPreview(null)}
          onConfirm={confirmMinutes}
          onUserCreated={(u) => setUsers((prev) => (prev.some((x) => x.id === u.id) ? prev : [...prev, u]))}
        />
      )}

      {showArchive && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("tasks.archived")}</h2>
              <button
                onClick={() => setShowArchive(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            {archived.length === 0 && <p className="text-sm text-slate-400">{t("tasks.noArchived")}</p>}
            <div className="space-y-2">
              {archived.map((row) => (
                <div key={row.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{row.title}</div>
                    <div className="text-xs text-slate-400">
                      {row.case?.caseNo || row.meeting?.title || t("common.none")}
                    </div>
                  </div>
                  <button
                    className="text-xs text-[var(--axon-blue)]"
                    onClick={async () => {
                      await apiFetch("/api/tasks", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: row.id, archived: false }),
                      });
                      await load();
                    }}
                  >
                    {t("tasks.restore")}
                  </button>
                  <button
                    className="text-xs text-rose-600"
                    onClick={async () => {
                      if (!window.confirm(t("tasks.deleteCardConfirm"))) return;
                      await apiFetch("/api/tasks", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: row.id, delete: true }),
                      });
                      await load();
                    }}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MinutesPreviewModal({
  preview,
  users,
  confirming,
  onChange,
  onClose,
  onConfirm,
  onUserCreated,
}: {
  preview: MinutesPreview;
  users: UserOpt[];
  confirming: boolean;
  onChange: (p: MinutesPreview) => void;
  onClose: () => void;
  onConfirm: () => void;
  onUserCreated: (u: UserOpt) => void;
}) {
  const { t } = useI18n();
  const [lang, setLang] = useState<MinutesOutputLang>(preview.outputLang || "original");
  const [reapplying, setReapplying] = useState(false);
  const [reapplyError, setReapplyError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [creatingIdx, setCreatingIdx] = useState<number | null>(null);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    setLang(preview.outputLang || "original");
  }, [preview.outputLang]);

  function updateAction(idx: number, patch: Partial<PreviewAction>) {
    const actions = preview.actions.map((a, i) => (i === idx ? { ...a, ...patch } : a));
    onChange({ ...preview, actions });
  }

  function openCreatePerson(idx: number) {
    const a = preview.actions[idx];
    setCreatingIdx(idx);
    setCreateName((a?.assigneeName || "").trim());
    setCreateEmail("");
    setCreateError("");
  }

  function closeCreatePerson() {
    setCreatingIdx(null);
    setCreateName("");
    setCreateEmail("");
    setCreateError("");
  }

  async function submitCreatePerson() {
    const name = createName.trim();
    const email = createEmail.trim().toLowerCase();
    if (!name || !email) {
      setCreateError(t("tasks.needNameEmail"));
      return;
    }
    setCreateBusy(true);
    setCreateError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role: "SUPERVISOR" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        name?: string;
        error?: string;
      };
      if (!res.ok) {
        if (res.status === 409 || data.error === "email already exists") {
          setCreateError(t("tasks.emailExists"));
        } else if (res.status === 403) {
          setCreateError(t("tasks.noPermAdd"));
        } else {
          setCreateError(data.error || t("tasks.addFail"));
        }
        return;
      }
      if (!data.id || !data.name) {
        setCreateError(t("tasks.addFail"));
        return;
      }
      const user: UserOpt = { id: data.id, name: data.name };
      onUserCreated(user);
      const key = name.toLowerCase();
      onChange({
        ...preview,
        actions: preview.actions.map((a) => {
          if (a.assigneeId) return a;
          if ((a.assigneeName || "").trim().toLowerCase() !== key) return a;
          return { ...a, assigneeId: user.id, assigneeName: user.name, matchedName: user.name };
        }),
      });
      closeCreatePerson();
    } catch {
      setCreateError(t("common.networkError"));
    } finally {
      setCreateBusy(false);
    }
  }

  async function applyLanguage() {
    if (!preview.rawText?.trim()) {
      setReapplyError(t("tasks.noSource"));
      return;
    }
    setReapplying(true);
    setReapplyError("");
    try {
      const data = await repreviewMinutesText({
        rawText: preview.rawText,
        fileName: preview.sourceName,
        outputLang: lang,
      });
      onChange({
        ...preview,
        title: data.title,
        meetingAt: data.meetingAt ?? preview.meetingAt,
        actions: data.actions || [],
        outputLang: data.outputLang || lang,
        mock: data.mock,
      });
    } catch (err) {
      setReapplyError(err instanceof Error ? err.message : t("tasks.reanalyzeFail"));
    } finally {
      setReapplying(false);
    }
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center bg-black/45 p-3",
        expanded ? "items-stretch" : "items-end sm:items-start sm:pt-10",
      )}
    >
      <div
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-2xl",
          expanded
            ? "h-[calc(100vh-1.5rem)] max-h-[calc(100vh-1.5rem)] max-w-[min(100%,72rem)]"
            : "max-h-[90vh] max-w-3xl",
        )}
      >
        <div className="mb-4 flex shrink-0 items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--axon-ink)]">{t("tasks.analyzeTitle")}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {t("tasks.fromSource", { name: preview.sourceName })}
              {preview.mock ? t("tasks.mockSuffix") : ""}
              {t("tasks.previewHint")}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              title={expanded ? t("common.collapse") : t("common.expand")}
            >
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-violet-200/80 bg-violet-50/50 px-3 py-2">
          <span className="text-xs font-medium text-violet-900">{t("tasks.minutesOut")}</span>
          <MinutesLangSwitch value={lang} onChange={setLang} disabled={reapplying || confirming} />
          <button
            type="button"
            disabled={reapplying || confirming || lang === (preview.outputLang || "original")}
            onClick={applyLanguage}
            className="axon-btn axon-btn-ghost min-h-8 px-3 text-xs"
          >
            {reapplying ? t("common.applying") : t("common.apply")}
          </button>
          {reapplyError && <span className="text-xs text-rose-600">{reapplyError}</span>}
        </div>

          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              {t("tasks.listName")}
              <input
                className="axon-input mt-1 min-h-0 py-2 text-sm"
                value={preview.title}
                onChange={(e) => onChange({ ...preview, title: e.target.value })}
              />
            </label>
            <label className="text-xs text-slate-500">
              {t("tasks.meetingDate")}
              <input
                type="date"
                className="axon-input mt-1 min-h-0 py-2 text-sm"
                value={preview.meetingAt || ""}
                onChange={(e) => onChange({ ...preview, meetingAt: e.target.value || null })}
              />
            </label>
          </div>

          <div className="space-y-3">
            {preview.actions.map((a, idx) => {
              const unmatched = Boolean(a.assigneeName?.trim() && !a.assigneeId);
              return (
                <div
                  key={idx}
                  className="space-y-2 rounded-xl border border-[var(--axon-line)] bg-slate-50/80 p-3"
                >
                  <textarea
                    className="axon-input min-h-[4.5rem] resize-y py-2 text-sm"
                    rows={3}
                    value={a.title}
                    onChange={(e) => updateAction(idx, { title: e.target.value })}
                    placeholder={t("tasks.actionPh")}
                  />
                  <textarea
                    className="axon-input min-h-[3rem] resize-y py-2 text-xs text-slate-600"
                    rows={2}
                    value={a.notes || ""}
                    onChange={(e) => updateAction(idx, { notes: e.target.value || null })}
                    placeholder={t("tasks.notesOpt")}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="axon-input min-h-0 min-w-[9rem] flex-1 py-2 text-xs sm:max-w-[180px]"
                      value={a.assigneeId || ""}
                      onChange={(e) =>
                        updateAction(idx, {
                          assigneeId: e.target.value || null,
                          assigneeName:
                            users.find((u) => u.id === e.target.value)?.name || a.assigneeName,
                        })
                      }
                    >
                      <option value="">
                        {a.assigneeName ? t("tasks.unmatched", { name: a.assigneeName }) : t("common.unassigned")}
                      </option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      className="axon-input min-h-0 w-[140px] py-2 text-xs"
                      value={a.dueAt || ""}
                      onChange={(e) => updateAction(idx, { dueAt: e.target.value || null })}
                    />
                    <button
                      type="button"
                      className="rounded-lg px-2 py-2 text-rose-600 hover:bg-rose-50"
                      onClick={() => {
                        if (creatingIdx === idx) closeCreatePerson();
                        onChange({
                          ...preview,
                          actions: preview.actions.filter((_, i) => i !== idx),
                        });
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {unmatched && creatingIdx !== idx && (
                    <button
                      type="button"
                      disabled={confirming || createBusy}
                      onClick={() => openCreatePerson(idx)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--axon-blue)] hover:bg-sky-50"
                    >
                      <UserPlus size={13} />
                      {t("tasks.addNamedPerson", { name: a.assigneeName || "" })}
                    </button>
                  )}
                  {creatingIdx === idx && (
                    <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                      <div className="mb-2 text-xs font-medium text-slate-600">{t("tasks.addPerson")}</div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-[11px] text-slate-500">
                          {t("common.name")}
                          <input
                            className="axon-input mt-1 min-h-0 py-1.5 text-sm"
                            value={createName}
                            onChange={(e) => setCreateName(e.target.value)}
                            disabled={createBusy}
                          />
                        </label>
                        <label className="text-[11px] text-slate-500">
                          {t("common.email")}
                          <input
                            type="email"
                            className="axon-input mt-1 min-h-0 py-1.5 text-sm"
                            value={createEmail}
                            onChange={(e) => setCreateEmail(e.target.value)}
                            placeholder="required@example.com"
                            disabled={createBusy}
                          />
                        </label>
                      </div>
                      {createError && (
                        <p className="mt-2 text-xs text-rose-600">{createError}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={createBusy}
                          onClick={submitCreatePerson}
                          className="axon-btn axon-btn-primary min-h-8 px-3 text-xs"
                        >
                          {createBusy ? t("common.creating") : t("tasks.createAssign")}
                        </button>
                        <button
                          type="button"
                          disabled={createBusy}
                          onClick={closeCreatePerson}
                          className="axon-btn axon-btn-ghost min-h-8 px-3 text-xs"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {preview.actions.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">{t("tasks.noActions")}</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--axon-line)] pt-4">
          <button type="button" onClick={onClose} className="axon-btn axon-btn-ghost min-h-9 px-4 text-sm">
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={confirming || reapplying || createBusy || preview.actions.length === 0}
            onClick={onConfirm}
            className="axon-btn axon-btn-primary min-h-9 px-4 text-sm"
          >
            {confirming ? t("common.creating") : t("tasks.createList", { n: preview.actions.length })}
          </button>
        </div>
      </div>
    </div>
  );
}

function AttachmentPreview({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: TaskAttachment[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const item = items[index];
  const src = attachmentSrc(item);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onIndexChange(Math.max(0, index - 1));
      if (e.key === "ArrowRight") onIndexChange(Math.min(items.length - 1, index + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onIndexChange]);

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/85 p-3"
      role="dialog"
      aria-label={t("tasks.preview")}
      onClick={onClose}
    >
      <div className="flex shrink-0 items-center gap-2 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1 truncate text-sm font-medium">
          {item.name}
          {items.length > 1 ? `  ${index + 1}/${items.length}` : ""}
        </div>
        {src && (
          <>
            <a
              href={src}
              download={item.name}
              className="rounded-lg p-2 hover:bg-white/10"
              title={t("tasks.download")}
            >
              <Download size={18} />
            </a>
            <a
              href={src}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg p-2 hover:bg-white/10"
              title={t("tasks.openFile")}
            >
              <ExternalLink size={18} />
            </a>
          </>
        )}
        <button type="button" className="rounded-lg p-2 hover:bg-white/10" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {items.length > 1 && (
          <button
            type="button"
            className="absolute left-1 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
            onClick={() => onIndexChange(Math.max(0, index - 1))}
            disabled={index === 0}
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="max-h-full max-w-full px-12">
          {!src ? (
            <p className="text-sm text-white/70">{item.name}</p>
          ) : isImageAttachment(item) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={item.name} className="max-h-[80vh] max-w-full rounded object-contain" />
          ) : isPdfAttachment(item) ? (
            <iframe title={item.name} src={src} className="h-[80vh] w-[min(100vw-4rem,900px)] rounded bg-white" />
          ) : isVideoAttachment(item) ? (
            <video src={src} controls className="max-h-[80vh] max-w-full rounded" />
          ) : isAudioAttachment(item) ? (
            <audio src={src} controls className="w-[min(100%,480px)]" />
          ) : (
            <div className="rounded-xl bg-white p-6 text-center text-slate-700">
              <Paperclip className="mx-auto mb-3 text-slate-400" size={28} />
              <div className="mb-3 text-sm font-medium">{item.name}</div>
              <a href={src} target="_blank" rel="noreferrer" className="text-sm text-[var(--axon-blue)]">
                {t("tasks.openFile")}
              </a>
            </div>
          )}
        </div>
        {items.length > 1 && (
          <button
            type="button"
            className="absolute right-1 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
            onClick={() => onIndexChange(Math.min(items.length - 1, index + 1))}
            disabled={index === items.length - 1}
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>
    </div>
  );
}

function CardModal({
  task,
  users,
  onClose,
  onSave,
  onCopy,
  onReload,
}: {
  task: Task;
  users: UserOpt[];
  onClose: () => void;
  onSave: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onCopy: (id: string) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const { t, taskStatusLabels } = useI18n();
  const isMeeting = Boolean(task.meetingId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(task.title);
  const [instructions, setInstructions] = useState(task.instructions || "");
  const [labels, setLabels] = useState(parseLabels(task.labelsJson));
  const [cover, setCover] = useState(task.coverColor || "");
  const [due, setDue] = useState(task.dueAt ? task.dueAt.slice(0, 10) : "");
  const [assigneeId, setAssigneeId] = useState(task.assignee?.id || "");
  const [status, setStatus] = useState(task.status);
  const [checks, setChecks] = useState(parseChecklist(task.checklistJson));
  const [newCheck, setNewCheck] = useState("");
  const [attachments, setAttachments] = useState<TaskAttachment[]>(task.attachments || []);
  const [comments, setComments] = useState<TaskComment[]>(task.comments || []);
  const [commentDraft, setCommentDraft] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [attachBusy, setAttachBusy] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [attachError, setAttachError] = useState("");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const coverMeta = labelMeta(cover);
  const coverSrc = coverImage({ ...task, attachments });

  useEffect(() => {
    setTitle(task.title);
    setInstructions(task.instructions || "");
    setLabels(parseLabels(task.labelsJson));
    setCover(task.coverColor || "");
    setDue(task.dueAt ? task.dueAt.slice(0, 10) : "");
    setAssigneeId(task.assignee?.id || "");
    setStatus(task.status);
    setChecks(parseChecklist(task.checklistJson));
    setAttachments(task.attachments || []);
    setComments(task.comments || []);
  }, [task]);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.files || []);
      if (!files.length) return;
      e.preventDefault();
      void addFiles(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  async function addFiles(files: FileList | File[] | null) {
    const list = Array.from(files || []).filter((f) => f.size > 0);
    if (list.length === 0) return;
    if (attachments.length + list.length > 50) {
      setAttachError(t("tasks.tooManyAttachments"));
      return;
    }
    setAttachBusy(true);
    setAttachError("");
    const form = new FormData();
    let skipped = false;
    for (const file of list) {
      if (file.size > 12_000_000) {
        skipped = true;
        continue;
      }
      form.append("file", file);
    }
    if (skipped) setAttachError(t("tasks.tooLarge"));
    if (![...form.keys()].includes("file")) {
      setAttachBusy(false);
      return;
    }
    const res = await apiFetch<{ attachments?: TaskAttachment[] }>(`/api/tasks/${task.id}/attachments`, {
      method: "POST",
      body: form,
    });
    if (res.ok) {
      const rows = asArray<TaskAttachment>(res.data.attachments);
      if (rows.length) setAttachments((prev) => [...prev, ...rows]);
    } else {
      setAttachError(res.error);
    }
    setAttachBusy(false);
    await onReload();
  }

  async function addLink() {
    const url = linkUrl.trim();
    if (!url) return;
    setAttachBusy(true);
    setAttachError("");
    const res = await apiFetch<TaskAttachment>(`/api/tasks/${task.id}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, name: url }),
    });
    setAttachBusy(false);
    if (res.ok && res.data) {
      setAttachments((prev) => [...prev, res.data]);
      setLinkUrl("");
      setShowLink(false);
      await onReload();
    } else if (!res.ok) {
      setAttachError(res.error);
    }
  }

  async function removeAttachment(id: string) {
    await apiFetch(`/api/tasks/${task.id}/attachments?id=${id}`, { method: "DELETE" });
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    await onReload();
  }

  async function removeComment(id: string) {
    await apiFetch(`/api/tasks/${task.id}/comments?id=${id}`, { method: "DELETE" });
    setComments((prev) => prev.filter((c) => c.id !== id));
    await onReload();
  }

  async function setCoverAttachment(id: string, on: boolean) {
    const res = await apiFetch<TaskAttachment>(`/api/tasks/${task.id}/attachments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isCover: on }),
    });
    if (res.ok) {
      setAttachments((prev) =>
        prev.map((a) => ({ ...a, isCover: on ? a.id === id : false })),
      );
      await onReload();
    }
  }

  async function addComment() {
    const body = commentDraft.trim();
    if (!body) return;
    const res = await apiFetch<TaskComment>(`/api/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (res.ok && res.data) {
      setComments((prev) => [...prev, res.data!]);
      setCommentDraft("");
      await onReload();
    }
  }

  function toggleLabel(id: string) {
    const next = labels.includes(id) ? labels.filter((x) => x !== id) : [...labels, id];
    setLabels(next);
    onSave(task.id, { labelsJson: JSON.stringify(next) });
  }

  function persistChecks(next: TaskCheckItem[]) {
    setChecks(next);
    onSave(task.id, { checklistJson: JSON.stringify(next) });
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-start sm:pt-12">
      <div
        className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[#f4f5f7] shadow-2xl"
        onDragOver={(e) => {
          if (![...e.dataTransfer.types].includes("Files")) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragOver(false);
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.files?.length) return;
          e.preventDefault();
          setDragOver(false);
          void addFiles(Array.from(e.dataTransfer.files));
        }}
      >
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-[var(--axon-blue)] bg-sky-50/80 text-sm font-medium text-[var(--axon-blue)]">
            {t("tasks.dropFiles")}
          </div>
        )}
        {coverSrc ? (
          <button
            type="button"
            className="block w-full"
            onClick={() => {
              const i = attachments.findIndex((a) => a.isCover);
              setPreviewIndex(i >= 0 ? i : 0);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverSrc} alt="" className="h-36 w-full rounded-t-2xl object-cover" />
          </button>
        ) : (
          coverMeta && <div className="h-24 w-full rounded-t-2xl" style={{ background: coverMeta.hex }} />
        )}
        <div className="grid gap-5 p-5 md:grid-cols-[1fr_220px]">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <input
                className="w-full bg-transparent text-xl font-semibold text-slate-800 outline-none"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() =>
                  title.trim() && title !== task.title && onSave(task.id, { title: title.trim() })
                }
              />
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {isMeeting ? (
                <>
                  {t("tasks.meetingList")}{" "}
                  <span className="font-medium text-purple-800">
                    {task.meeting?.title || t("tasks.meeting")}
                  </span>
                </>
              ) : (
                <>
                  {t("tasks.inList")}{" "}
                  <span
                    className="font-medium"
                    style={{ color: COLUMN_THEME[status as TaskColumnId]?.ink }}
                  >
                    {taskStatusLabels[status] || COLUMN_THEME[status as TaskColumnId]?.name}
                  </span>
                  {task.case && (
                    <>
                      {" · "}
                      <Link href={`/cases/${task.case.id}`} className="text-[var(--axon-blue)]">
                        {task.case.caseNo} {task.case.title}
                      </Link>
                    </>
                  )}
                </>
              )}
            </p>

            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {labels.map((id) => {
                  const meta = labelMeta(id);
                  if (!meta) return null;
                  return (
                    <span
                      key={id}
                      className="rounded px-2 py-0.5 text-xs font-medium text-white"
                      style={{ background: meta.hex }}
                    >
                      {meta.name}
                    </span>
                  );
                })}
              </div>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">{t("tasks.desc")}</h3>
              <textarea
                className="axon-input min-h-[180px] resize-y whitespace-pre-wrap"
                placeholder={t("tasks.descPh")}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                onBlur={() => onSave(task.id, { instructions })}
              />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">{t("tasks.checklist")}</h3>
              <div className="space-y-1.5">
                {checks.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() =>
                        persistChecks(
                          checks.map((c) =>
                            c.id === item.id ? { ...c, checked: !c.checked } : c,
                          ),
                        )
                      }
                    />
                    <span className={cn("flex-1", item.checked && "text-slate-400 line-through")}>
                      {item.text}
                    </span>
                    <button
                      type="button"
                      className="text-slate-300 hover:text-rose-500"
                      onClick={() => persistChecks(checks.filter((c) => c.id !== item.id))}
                    >
                      <X size={12} />
                    </button>
                  </label>
                ))}
                <div className="flex gap-2">
                  <input
                    className="axon-input min-h-0 py-2 text-sm"
                    placeholder={t("tasks.checklistPh")}
                    value={newCheck}
                    onChange={(e) => setNewCheck(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newCheck.trim()) {
                        persistChecks([
                          ...checks,
                          { id: crypto.randomUUID(), text: newCheck.trim(), checked: false },
                        ]);
                        setNewCheck("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="axon-btn axon-btn-ghost min-h-9 px-3 text-xs"
                    onClick={() => {
                      if (!newCheck.trim()) return;
                      persistChecks([
                        ...checks,
                        { id: crypto.randomUUID(), text: newCheck.trim(), checked: false },
                      ]);
                      setNewCheck("");
                    }}
                  >
                    {t("common.addItem")}
                  </button>
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Paperclip size={14} /> {t("tasks.attachments")}
              </h3>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const list = Array.from(e.target.files || []);
                  e.target.value = "";
                  void addFiles(list);
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                {attachments.length === 0 && (
                  <p className="col-span-2 text-xs text-slate-400">{t("tasks.noAttachments")}</p>
                )}
                {attachments.map((a, idx) => {
                  const href = attachmentSrc(a);
                  const image = isImageAttachment(a);
                  return (
                    <div key={a.id} className="overflow-hidden rounded-lg bg-white">
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() => setPreviewIndex(idx)}
                      >
                        {image && href ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={href} alt="" className="h-28 w-full object-cover" />
                        ) : (
                          <div className="flex h-28 w-full items-center justify-center bg-slate-100 text-slate-400">
                            {isPdfAttachment(a) ? (
                              <span className="text-xs font-semibold">PDF</span>
                            ) : a.url ? (
                              <Link2 size={20} />
                            ) : (
                              <Paperclip size={20} />
                            )}
                          </div>
                        )}
                        <div className="truncate px-2 py-1.5 text-xs font-medium text-slate-700">
                          {a.name}
                        </div>
                      </button>
                      <div className="flex items-center justify-between gap-1 px-2 pb-1.5">
                        {a.isCover ? (
                          <span className="text-[10px] text-slate-400">{t("tasks.coverPhoto")}</span>
                        ) : image ? (
                          <button
                            type="button"
                            className="text-[10px] text-slate-500 hover:text-slate-800"
                            onClick={() => setCoverAttachment(a.id, true)}
                          >
                            {t("tasks.setCover")}
                          </button>
                        ) : (
                          <span />
                        )}
                        <button
                          type="button"
                          className="text-slate-300 hover:text-rose-500"
                          onClick={() => {
                            if (previewIndex === idx) setPreviewIndex(null);
                            void removeAttachment(a.id);
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  disabled={attachBusy}
                  onClick={() => fileRef.current?.click()}
                  className="flex h-full min-h-28 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/60 text-xs text-slate-500 hover:border-[var(--axon-blue)] hover:text-[var(--axon-blue)]"
                >
                  <Plus size={18} className="mb-1" />
                  {t("tasks.attachFile")}
                </button>
              </div>
              {attachError && <p className="mt-2 text-xs text-rose-600">{attachError}</p>}
              {attachBusy && <p className="mt-2 text-xs text-slate-500">{t("tasks.attaching")}</p>}
              {showLink && (
                <div className="mt-2 flex gap-2">
                  <input
                    className="axon-input min-h-0 py-2 text-sm"
                    placeholder="https://"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void addLink();
                    }}
                  />
                  <button type="button" className="axon-btn axon-btn-primary min-h-9 px-3 text-xs" onClick={() => void addLink()}>
                    {t("common.add")}
                  </button>
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <MessageSquare size={14} /> {t("tasks.comments")}
              </h3>
              <div className="space-y-2">
                {comments.map((c) => (
                  <div key={c.id} className="rounded-lg bg-white px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[11px] text-slate-400">
                        {c.actor?.name || t("common.unassigned")} · {new Date(c.createdAt).toLocaleString("zh-HK")}
                      </div>
                      <button
                        type="button"
                        className="text-slate-300 hover:text-rose-500"
                        onClick={() => void removeComment(c.id)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{c.body}</p>
                  </div>
                ))}
                <textarea
                  className="axon-input min-h-[72px] resize-y text-sm"
                  placeholder={t("tasks.commentPh")}
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                />
                <button
                  type="button"
                  className="axon-btn axon-btn-primary min-h-9 px-3 text-xs"
                  onClick={() => void addComment()}
                >
                  {t("tasks.addComment")}
                </button>
              </div>
            </section>
          </div>

          <aside className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {t("tasks.addToCard")}
            </p>
            <label className="block text-xs text-slate-500">
              <span className="mb-1 flex items-center gap-1">
                <UserRound size={12} /> {t("tasks.members")}
              </span>
              <select
                className="axon-input min-h-0 py-2 text-sm"
                value={assigneeId}
                onChange={(e) => {
                  setAssigneeId(e.target.value);
                  onSave(task.id, { assigneeId: e.target.value || null });
                }}
              >
                <option value="">{t("common.unassigned")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <div className="mb-1 text-xs text-slate-500">{t("tasks.tags")}</div>
              <div className="grid grid-cols-5 gap-1.5">
                {TASK_LABELS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    title={l.name}
                    onClick={() => toggleLabel(l.id)}
                    className={cn(
                      "h-7 rounded",
                      labels.includes(l.id) && "ring-2 ring-offset-1 ring-slate-700",
                    )}
                    style={{ background: l.hex }}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs text-slate-500">{t("tasks.cover")}</div>
              <div className="grid grid-cols-5 gap-1.5">
                {TASK_LABELS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      const next = cover === l.id ? "" : l.id;
                      setCover(next);
                      onSave(task.id, { coverColor: next || null });
                    }}
                    className={cn(
                      "h-7 rounded",
                      cover === l.id && "ring-2 ring-offset-1 ring-slate-700",
                    )}
                    style={{ background: l.hex }}
                  />
                ))}
              </div>
            </div>
            <label className="block text-xs text-slate-500">
              {t("tasks.dueDate")}
              <input
                type="date"
                className="axon-input mt-1 min-h-0 py-2 text-sm"
                value={due}
                onChange={(e) => {
                  setDue(e.target.value);
                  onSave(task.id, { dueAt: e.target.value || null });
                }}
              />
            </label>
            {!isMeeting && (
              <label className="block text-xs text-slate-500">
                {t("tasks.moveTo")}
                <select
                  className="axon-input mt-1 min-h-0 py-2 text-sm"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    onSave(task.id, { status: e.target.value });
                  }}
                >
                  {TASK_COLUMNS.map((c) => (
                    <option key={c} value={c}>
                      {taskStatusLabels[c] || COLUMN_THEME[c].name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {isMeeting && (
              <label className="block text-xs text-slate-500">
                {t("tasks.doneStatus")}
                <select
                  className="axon-input mt-1 min-h-0 py-2 text-sm"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    onSave(task.id, { status: e.target.value });
                  }}
                >
                  <option value="PENDING">{taskStatusLabels.PENDING || t("common.pending")}</option>
                  <option value="IN_PROGRESS">{taskStatusLabels.IN_PROGRESS || t("common.inProgress")}</option>
                  <option value="DONE">{taskStatusLabels.DONE || t("common.completed")}</option>
                </select>
              </label>
            )}
            <button
              type="button"
              disabled={attachBusy}
              className="axon-btn axon-btn-ghost w-full min-h-9 text-sm"
              onClick={() => fileRef.current?.click()}
            >
              <Paperclip size={14} />
              {t("tasks.attachFile")}
            </button>
            <button
              type="button"
              className="axon-btn axon-btn-ghost w-full min-h-9 text-sm"
              onClick={() => setShowLink(true)}
            >
              <Link2 size={14} />
              {t("tasks.attachLink")}
            </button>
            <button
              type="button"
              className="axon-btn axon-btn-ghost w-full min-h-9 text-sm"
              onClick={() => void onCopy(task.id)}
            >
              <Copy size={14} />
              {t("tasks.copyCard")}
            </button>
            <button
              type="button"
              className="axon-btn axon-btn-ghost w-full min-h-9 text-sm"
              onClick={() => onSave(task.id, { archived: true })}
            >
              <Archive size={14} />
              {t("tasks.archive")}
            </button>
            <button
              type="button"
              className="axon-btn axon-btn-ghost w-full min-h-9 text-sm text-rose-700"
              onClick={() => {
                if (window.confirm(t("tasks.deleteCardConfirm"))) onSave(task.id, { delete: true });
              }}
            >
              <Trash2 size={14} />
              {t("common.delete")}
            </button>
          </aside>
        </div>
      </div>
    </div>
    {previewIndex != null && attachments[previewIndex] && (
      <AttachmentPreview
        items={attachments}
        index={previewIndex}
        onIndexChange={setPreviewIndex}
        onClose={() => setPreviewIndex(null)}
      />
    )}
    </>
  );
}
