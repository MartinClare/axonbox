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
  FileUp,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { STATUS_COLORS, TASK_STATUS_LABELS, cn, daysRemaining, formatDay } from "@/lib/labels";
import { apiFetch, asArray } from "@/lib/api-client";
import { type MinutesOutputLang, type MinutesProgress, takeMinutesPreview, uploadMinutesPreview, repreviewMinutesText } from "@/lib/file-base64";
import { MinutesProgressOverlay } from "@/components/MinutesProgressOverlay";
import { MinutesLangSwitch } from "@/components/MinutesLangSwitch";
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

function TaskCardFace({ task, muted }: { task: Task; muted?: boolean }) {
  const labels = parseLabels(task.labelsJson);
  const checks = parseChecklist(task.checklistJson);
  const done = checks.filter((c) => c.checked).length;
  const cover = labelMeta(task.coverColor || "");
  const remain = daysRemaining(task.dueAt);
  const overdue = remain !== null && remain < 0 && task.status !== "DONE";
  const badge = task.meetingId
    ? "會議"
    : task.case?.caseNo || "—";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5",
        muted && "opacity-70",
        overdue && "ring-rose-300",
      )}
    >
      {cover && <div className="h-8 w-full" style={{ background: cover.hex }} />}
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
    setUploadProgress({ pct: 4, label: "開始處理…" });
    try {
      const data = await uploadMinutesPreview(file, setUploadProgress, {
        outputLang: minutesLang,
      });
      setUploadProgress({ pct: 100, label: "完成" });
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
      setError(err instanceof Error ? err.message : "上傳失敗");
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
      setError(res.error || "建立失敗");
      return;
    }
    setPreview(null);
    await load();
    if (res.data?.id) setFocusMeetingId(res.data.id);
  }

  async function renameMeeting(id: string) {
    const current = meetings.find((m) => m.id === id);
    const next = window.prompt("列表名稱", current?.title || "");
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
    if (!window.confirm("刪除此會議列表及其中所有卡片？")) return;
    await apiFetch(`/api/meetings/${id}`, { method: "DELETE" });
    setMenuMeetingId(null);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="axon-title text-2xl font-semibold">任務管理</h1>
          <p className="text-sm axon-muted">
            左側為事件跟進；右側每份會議紀錄自成一個列表，互不混淆
          </p>
          {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MinutesLangSwitch value={minutesLang} onChange={setMinutesLang} disabled={uploading} />
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
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="axon-btn axon-btn-primary min-h-9 px-3 text-sm"
          >
            <FileUp size={14} />
            {uploading ? "處理中…" : "上傳會議紀錄"}
          </button>
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" />
            <input
              className="axon-input h-9 min-h-0 w-44 pl-8 text-sm"
              placeholder="搜尋卡片…"
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
            封存 {archived.length}
          </button>
          <div className="flex gap-1 rounded-lg bg-white p-1 ring-1 ring-[var(--axon-line)]">
            <button
              onClick={() => setView("board")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                view === "board" ? "bg-[var(--axon-ink)] text-white" : "text-slate-600",
              )}
            >
              看板
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm",
                view === "list" ? "bg-[var(--axon-ink)] text-white" : "text-slate-600",
              )}
            >
              列表
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
            清除篩選
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
                        {theme.name}
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
                          placeholder="輸入卡片標題…"
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
                          {cases.length === 0 && <option value="">尚無事件可關聯</option>}
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
                            新增卡片
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
                        新增卡片
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
                          會議列表
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
                              重新命名
                            </button>
                            <button
                              type="button"
                              className="block w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50"
                              onClick={() => deleteMeeting(m.id)}
                            >
                              刪除列表
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
                        const title = window.prompt("新行動項目");
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
                      新增卡片
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
                <th className="px-4 py-3">任務</th>
                <th className="px-4 py-3">來源</th>
                <th className="px-4 py-3">負責人</th>
                <th className="px-4 py-3">期限</th>
                <th className="px-4 py-3">狀態</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer border-t hover:bg-slate-50"
                  onClick={() => setOpen(t)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {parseLabels(t.labelsJson)
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
                      {t.title}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {t.case ? (
                      <Link
                        href={`/cases/${t.case.id}`}
                        className="text-[var(--axon-blue)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {t.case.caseNo}
                      </Link>
                    ) : (
                      <span className="text-purple-700">{t.meeting?.title || "會議"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{t.assignee?.name || "—"}</td>
                  <td className="px-4 py-3">{t.dueAt ? formatDay(t.dueAt) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS_COLORS[t.status])}>
                      {TASK_STATUS_LABELS[t.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <CardModal task={open} users={users} onClose={() => setOpen(null)} onSave={saveTask} />
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
              <h2 className="text-lg font-semibold">已封存卡片</h2>
              <button
                onClick={() => setShowArchive(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            {archived.length === 0 && <p className="text-sm text-slate-400">沒有封存卡片</p>}
            <div className="space-y-2">
              {archived.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-slate-400">
                      {t.case?.caseNo || t.meeting?.title || "—"}
                    </div>
                  </div>
                  <button
                    className="text-xs text-[var(--axon-blue)]"
                    onClick={async () => {
                      await apiFetch("/api/tasks", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: t.id, archived: false }),
                      });
                      await load();
                    }}
                  >
                    還原
                  </button>
                  <button
                    className="text-xs text-rose-600"
                    onClick={async () => {
                      if (!window.confirm("永久刪除此卡片？")) return;
                      await apiFetch("/api/tasks", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ id: t.id, delete: true }),
                      });
                      await load();
                    }}
                  >
                    刪除
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
      setCreateError("請填寫姓名與電郵");
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
          setCreateError("電郵已存在");
        } else if (res.status === 403) {
          setCreateError("無權限新增人員");
        } else {
          setCreateError(data.error || "新增失敗");
        }
        return;
      }
      if (!data.id || !data.name) {
        setCreateError("新增失敗");
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
      setCreateError("網路錯誤，請稍後再試");
    } finally {
      setCreateBusy(false);
    }
  }

  async function applyLanguage() {
    if (!preview.rawText?.trim()) {
      setReapplyError("沒有可重新分析的原文");
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
      setReapplyError(err instanceof Error ? err.message : "重新分析失敗");
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
            <h2 className="text-lg font-semibold text-[var(--axon-ink)]">分析會議紀錄</h2>
            <p className="mt-1 text-xs text-slate-500">
              來自 {preview.sourceName}
              {preview.mock ? " · Mock 分析" : ""}
              。確認行動項目後會在看板右側新增一個會議列表。
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              title={expanded ? "還原視窗" : "放大視窗"}
            >
              {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">輸出語言</span>
            <MinutesLangSwitch value={lang} onChange={setLang} disabled={reapplying || confirming} />
            <button
              type="button"
              disabled={reapplying || confirming || lang === (preview.outputLang || "original")}
              onClick={applyLanguage}
              className="axon-btn axon-btn-ghost min-h-8 px-3 text-xs"
            >
              {reapplying ? "套用中…" : "套用"}
            </button>
            {reapplyError && <span className="text-xs text-rose-600">{reapplyError}</span>}
          </div>

          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-500">
              列表名稱
              <input
                className="axon-input mt-1 min-h-0 py-2 text-sm"
                value={preview.title}
                onChange={(e) => onChange({ ...preview, title: e.target.value })}
              />
            </label>
            <label className="text-xs text-slate-500">
              會議日期
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
                    placeholder="行動項目"
                  />
                  <textarea
                    className="axon-input min-h-[3rem] resize-y py-2 text-xs text-slate-600"
                    rows={2}
                    value={a.notes || ""}
                    onChange={(e) => updateAction(idx, { notes: e.target.value || null })}
                    placeholder="備註（可選）"
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
                        {a.assigneeName ? `未對應：${a.assigneeName}` : "未指派"}
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
                      新增「{a.assigneeName}」
                    </button>
                  )}
                  {creatingIdx === idx && (
                    <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                      <div className="mb-2 text-xs font-medium text-slate-600">新增人員到通訊錄</div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-[11px] text-slate-500">
                          姓名
                          <input
                            className="axon-input mt-1 min-h-0 py-1.5 text-sm"
                            value={createName}
                            onChange={(e) => setCreateName(e.target.value)}
                            disabled={createBusy}
                          />
                        </label>
                        <label className="text-[11px] text-slate-500">
                          電郵
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
                          {createBusy ? "建立中…" : "建立並指派"}
                        </button>
                        <button
                          type="button"
                          disabled={createBusy}
                          onClick={closeCreatePerson}
                          className="axon-btn axon-btn-ghost min-h-8 px-3 text-xs"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {preview.actions.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">沒有行動項目</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--axon-line)] pt-4">
          <button type="button" onClick={onClose} className="axon-btn axon-btn-ghost min-h-9 px-4 text-sm">
            取消
          </button>
          <button
            type="button"
            disabled={confirming || reapplying || createBusy || preview.actions.length === 0}
            onClick={onConfirm}
            className="axon-btn axon-btn-primary min-h-9 px-4 text-sm"
          >
            {confirming ? "建立中…" : `建立列表（${preview.actions.length}）`}
          </button>
        </div>
      </div>
    </div>
  );
}

function CardModal({
  task,
  users,
  onClose,
  onSave,
}: {
  task: Task;
  users: UserOpt[];
  onClose: () => void;
  onSave: (id: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  const isMeeting = Boolean(task.meetingId);
  const [title, setTitle] = useState(task.title);
  const [instructions, setInstructions] = useState(task.instructions || "");
  const [labels, setLabels] = useState(parseLabels(task.labelsJson));
  const [cover, setCover] = useState(task.coverColor || "");
  const [due, setDue] = useState(task.dueAt ? task.dueAt.slice(0, 10) : "");
  const [assigneeId, setAssigneeId] = useState(task.assignee?.id || "");
  const [status, setStatus] = useState(task.status);
  const [checks, setChecks] = useState(parseChecklist(task.checklistJson));
  const [newCheck, setNewCheck] = useState("");
  const coverMeta = labelMeta(cover);

  useEffect(() => {
    setTitle(task.title);
    setInstructions(task.instructions || "");
    setLabels(parseLabels(task.labelsJson));
    setCover(task.coverColor || "");
    setDue(task.dueAt ? task.dueAt.slice(0, 10) : "");
    setAssigneeId(task.assignee?.id || "");
    setStatus(task.status);
    setChecks(parseChecklist(task.checklistJson));
  }, [task]);

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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-start sm:pt-12">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-[#f4f5f7] shadow-2xl">
        {coverMeta && <div className="h-24 w-full rounded-t-2xl" style={{ background: coverMeta.hex }} />}
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
                  會議列表{" "}
                  <span className="font-medium text-purple-800">
                    {task.meeting?.title || "會議"}
                  </span>
                </>
              ) : (
                <>
                  在列表{" "}
                  <span
                    className="font-medium"
                    style={{ color: COLUMN_THEME[status as TaskColumnId]?.ink }}
                  >
                    {COLUMN_THEME[status as TaskColumnId]?.name || TASK_STATUS_LABELS[status]}
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
              <h3 className="mb-2 text-sm font-semibold text-slate-700">描述</h3>
              <textarea
                className="axon-input min-h-[110px] resize-y"
                placeholder="加入更詳細的說明…"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                onBlur={() => onSave(task.id, { instructions })}
              />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">檢查清單</h3>
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
                    placeholder="新增清單項目…"
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
                    加入
                  </button>
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              加入到卡片
            </p>
            <label className="block text-xs text-slate-500">
              <span className="mb-1 flex items-center gap-1">
                <UserRound size={12} /> 成員
              </span>
              <select
                className="axon-input min-h-0 py-2 text-sm"
                value={assigneeId}
                onChange={(e) => {
                  setAssigneeId(e.target.value);
                  onSave(task.id, { assigneeId: e.target.value || null });
                }}
              >
                <option value="">未指派</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <div className="mb-1 text-xs text-slate-500">標籤</div>
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
              <div className="mb-1 text-xs text-slate-500">封面顏色</div>
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
              到期日
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
                移動到
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
                      {COLUMN_THEME[c].name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {isMeeting && (
              <label className="block text-xs text-slate-500">
                完成狀態
                <select
                  className="axon-input mt-1 min-h-0 py-2 text-sm"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    onSave(task.id, { status: e.target.value });
                  }}
                >
                  <option value="PENDING">待處理</option>
                  <option value="IN_PROGRESS">進行中</option>
                  <option value="DONE">已完成</option>
                </select>
              </label>
            )}
            <button
              type="button"
              className="axon-btn axon-btn-ghost w-full min-h-9 text-sm"
              onClick={() => onSave(task.id, { archived: true })}
            >
              <Archive size={14} />
              封存
            </button>
            <button
              type="button"
              className="axon-btn axon-btn-ghost w-full min-h-9 text-sm text-rose-700"
              onClick={() => {
                if (window.confirm("永久刪除此卡片？")) onSave(task.id, { delete: true });
              }}
            >
              <Trash2 size={14} />
              刪除
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
}
