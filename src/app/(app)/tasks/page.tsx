"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { STATUS_COLORS, TASK_STATUS_LABELS, cn, daysRemaining, formatDay } from "@/lib/labels";
import { apiFetch, asArray } from "@/lib/api-client";
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
  case: { id: string; caseNo: string; title: string };
  assignee?: { id?: string; name: string } | null;
};

type CaseOpt = { id: string; caseNo: string; title: string };
type UserOpt = { id: string; name: string };

function applyMove(list: Task[], activeCardId: string, overId: string): Task[] {
  const from = list.find((t) => t.id === activeCardId);
  if (!from) return list;
  const overIsColumn = TASK_COLUMNS.includes(overId as TaskColumnId);
  const overTask = list.find((t) => t.id === overId);
  const nextStatus = overIsColumn
    ? (overId as TaskColumnId)
    : ((overTask?.status || from.status) as TaskColumnId);
  const without = list.filter((t) => t.id !== activeCardId);
  const target = without
    .filter((t) => t.status === nextStatus)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  let index = target.length;
  if (overTask && overTask.status === nextStatus) {
    index = target.findIndex((t) => t.id === overTask.id);
    if (index < 0) index = target.length;
  }
  target.splice(index, 0, { ...from, status: nextStatus });
  const reindexed = target.map((t, i) => ({ ...t, sortOrder: i }));
  return [...without.filter((t) => t.status !== nextStatus), ...reindexed];
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
          <span className="rounded bg-slate-100 px-1.5 py-0.5">{task.case.caseNo}</span>
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
    data: { type: "card", status: task.status },
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
  id: TaskColumnId;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: "column", status: id } });
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
  const [tasks, setTasks] = useState<Task[]>([]);
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
  const justDragged = useRef(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function load() {
    const [taskRes, archRes, caseRes, settingsRes] = await Promise.all([
      apiFetch<Task[]>("/api/tasks"),
      apiFetch<Task[]>("/api/tasks?archived=1"),
      apiFetch<CaseOpt[]>("/api/cases"),
      apiFetch<{ users?: UserOpt[] }>("/api/settings"),
    ]);
    if (!taskRes.ok) {
      setTasks([]);
      setError(taskRes.error);
    } else {
      setTasks(asArray<Task>(taskRes.data));
      setError("");
    }
    setArchived(archRes.ok ? asArray<Task>(archRes.data) : []);
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

  const visible = useMemo(() => {
    return tasks.filter((t) => {
      const q = query.trim().toLowerCase();
      if (q && !`${t.title} ${t.case.caseNo} ${t.assignee?.name || ""}`.toLowerCase().includes(q)) {
        return false;
      }
      if (labelFilter && !parseLabels(t.labelsJson).includes(labelFilter)) return false;
      return true;
    });
  }, [tasks, query, labelFilter]);

  const activeTask = tasks.find((t) => t.id === activeId) || null;

  function columnTasks(col: string) {
    return visible
      .filter((t) => t.status === col)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  function moveLocal(activeCardId: string, overId: string) {
    setTasks((prev) => applyMove(prev, activeCardId, overId));
  }

  async function persistOrder(next: Task[]) {
    const reorder = TASK_COLUMNS.flatMap((col) =>
      next
        .filter((t) => t.status === col)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((t, i) => ({ id: t.id, status: t.status, sortOrder: i })),
    );
    await apiFetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorder }),
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
    const overIsColumn = TASK_COLUMNS.includes(overId as TaskColumnId);
    const overTask = tasks.find((t) => t.id === overId);
    const nextStatus = overIsColumn ? overId : overTask?.status;
    if (nextStatus && nextStatus !== from.status) moveLocal(activeCardId, overId);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="axon-title text-2xl font-semibold">任務管理</h1>
          <p className="text-sm axon-muted">拖曳卡片換欄，點開卡片編輯標籤、期限與清單</p>
          {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
                <th className="px-4 py-3">事件</th>
                <th className="px-4 py-3">負責人</th>
                <th className="px-4 py-3">期限</th>
                <th className="px-4 py-3">狀態</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id} className="cursor-pointer border-t hover:bg-slate-50" onClick={() => setOpen(t)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {parseLabels(t.labelsJson).slice(0, 3).map((id) => {
                        const meta = labelMeta(id);
                        return meta ? (
                          <span key={id} className="h-2 w-2 rounded-full" style={{ background: meta.hex }} />
                        ) : null;
                      })}
                      {t.title}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/cases/${t.case.id}`} className="text-[var(--axon-blue)]" onClick={(e) => e.stopPropagation()}>
                      {t.case.caseNo}
                    </Link>
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
        <CardModal
          task={open}
          users={users}
          onClose={() => setOpen(null)}
          onSave={saveTask}
        />
      )}

      {showArchive && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">已封存卡片</h2>
              <button onClick={() => setShowArchive(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            {archived.length === 0 && <p className="text-sm text-slate-400">沒有封存卡片</p>}
            <div className="space-y-2">
              {archived.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.title}</div>
                    <div className="text-xs text-slate-400">{t.case.caseNo}</div>
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
                onBlur={() => title.trim() && title !== task.title && onSave(task.id, { title: title.trim() })}
              />
              <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              在列表{" "}
              <span className="font-medium" style={{ color: COLUMN_THEME[status as TaskColumnId]?.ink }}>
                {COLUMN_THEME[status as TaskColumnId]?.name || TASK_STATUS_LABELS[status]}
              </span>
              {" · "}
              <Link href={`/cases/${task.case.id}`} className="text-[var(--axon-blue)]">
                {task.case.caseNo} {task.case.title}
              </Link>
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
                  <label key={item.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() =>
                        persistChecks(checks.map((c) => (c.id === item.id ? { ...c, checked: !c.checked } : c)))
                      }
                    />
                    <span className={cn("flex-1", item.checked && "text-slate-400 line-through")}>{item.text}</span>
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
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">加入到卡片</p>
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
                    className={cn("h-7 rounded", cover === l.id && "ring-2 ring-offset-1 ring-slate-700")}
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
