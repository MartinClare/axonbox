"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TASK_STATUS_LABELS,
  STATUS_COLORS,
  cn,
  formatDate,
  daysRemaining,
} from "@/lib/labels";
import { apiFetch, asArray } from "@/lib/api-client";

type Task = {
  id: string;
  title: string;
  instructions: string | null;
  status: string;
  dueAt: string | null;
  case: { id: string; caseNo: string; title: string };
  assignee?: { name: string } | null;
};

const COLUMNS = ["PENDING", "IN_PROGRESS", "PENDING_REVIEW", "DONE"] as const;

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [view, setView] = useState<"board" | "list">("board");
  const [error, setError] = useState("");

  async function load() {
    const res = await apiFetch<Task[]>("/api/tasks");
    if (!res.ok) {
      setTasks([]);
      setError(res.error);
      return;
    }
    setTasks(asArray<Task>(res.data));
    setError("");
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: string) {
    await apiFetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="axon-title text-2xl font-semibold">任務管理</h1>
          <p className="text-sm axon-muted">整改跟進 · 與事件雙向聯動</p>
          {error && <p className="mt-1 text-sm text-rose-600">{error}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView("board")}
            className={cn("rounded-lg px-3 py-1.5 text-sm", view === "board" ? "bg-[var(--axon-blue)] text-white" : "bg-white border")}
          >
            看板
          </button>
          <button
            onClick={() => setView("list")}
            className={cn("rounded-lg px-3 py-1.5 text-sm", view === "list" ? "bg-[var(--axon-blue)] text-white" : "bg-white border")}
          >
            列表
          </button>
        </div>
      </div>

      {view === "board" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{TASK_STATUS_LABELS[col]}</h2>
                <span className="text-xs text-slate-400">
                  {tasks.filter((t) => t.status === col).length}
                </span>
              </div>
              <div className="space-y-2">
                {tasks
                  .filter((t) => t.status === col)
                  .map((t) => {
                    const remain = daysRemaining(t.dueAt);
                    const overdue = remain !== null && remain < 0 && t.status !== "DONE";
                    return (
                      <div
                        key={t.id}
                        className={cn(
                          "rounded-lg border bg-white p-3 shadow-sm",
                          overdue && "border-rose-300"
                        )}
                      >
                        <Link
                          href={`/cases/${t.case.id}`}
                          className="text-sm font-medium text-[var(--axon-navy)] hover:underline"
                        >
                          {t.title}
                        </Link>
                        <div className="mt-1 text-xs text-slate-400">{t.case.caseNo}</div>
                        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                          <span>{t.assignee?.name || "未指派"}</span>
                          <span className={overdue ? "text-rose-600 font-medium" : ""}>
                            {t.dueAt ? formatDate(t.dueAt) : "無期限"}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {COLUMNS.filter((c) => c !== t.status).map((c) => (
                            <button
                              key={c}
                              onClick={() => setStatus(t.id, c)}
                              className="rounded bg-slate-100 px-2 py-0.5 text-[10px] hover:bg-slate-200"
                            >
                              → {TASK_STATUS_LABELS[c]}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
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
              {tasks.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="px-4 py-3">{t.title}</td>
                  <td className="px-4 py-3">
                    <Link href={`/cases/${t.case.id}`} className="text-[var(--axon-blue)]">
                      {t.case.caseNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{t.assignee?.name || "—"}</td>
                  <td className="px-4 py-3">{t.dueAt ? formatDate(t.dueAt) : "—"}</td>
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
    </div>
  );
}
