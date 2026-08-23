"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { apiFetch, asArray } from "@/lib/api-client";
import { STATUS_COLORS, cn } from "@/lib/labels";
import { useI18n } from "@/components/I18nProvider";

type TaskRow = {
  id: string;
  title: string;
  status: string;
  dueAt: string | null;
  case?: { id: string; caseNo: string; title: string; status: string } | null;
};

type Scope = "mine" | "all";

export default function FieldTasksPage() {
  const { t, taskStatusLabels } = useI18n();
  const [scope, setScope] = useState<Scope>("mine");
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (next: Scope) => {
    setLoading(true);
    const qs = next === "mine" ? "?mine=1" : "";
    const res = await apiFetch<TaskRow[]>(`/api/tasks${qs}`);
    if (res.ok) {
      setRows(asArray<TaskRow>(res.data).filter((task) => task.status !== "DONE"));
    } else {
      setRows([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(scope);
  }, [load, scope]);

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-[var(--axon-ink)]">{t("field.tab.tasks")}</h1>

      <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setScope("mine")}
          className={cn(
            "rounded-lg px-3 py-2 transition",
            scope === "mine" ? "bg-white text-[var(--axon-ink)] shadow-sm" : "text-slate-500",
          )}
        >
          {t("field.myTasks")}
        </button>
        <button
          type="button"
          onClick={() => setScope("all")}
          className={cn(
            "rounded-lg px-3 py-2 transition",
            scope === "all" ? "bg-white text-[var(--axon-ink)] shadow-sm" : "text-slate-500",
          )}
        >
          {t("field.allTasks")}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="animate-spin" size={22} />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">
          {scope === "mine" ? t("field.emptyMyTasks") : t("field.emptyTasks")}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((task) => {
            const href = task.case?.id ? `/cases/${task.case.id}` : "/tasks";
            const due = task.dueAt
              ? new Date(task.dueAt).toLocaleDateString("zh-HK", {
                  month: "numeric",
                  day: "numeric",
                })
              : null;
            return (
              <Link
                key={task.id}
                href={href}
                className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-[var(--axon-line)]"
              >
                <div className="min-w-0 flex-1">
                  {task.case?.caseNo && (
                    <div className="text-[11px] font-medium text-slate-400">{task.case.caseNo}</div>
                  )}
                  <div className="truncate text-sm font-semibold text-[var(--axon-ink)]">{task.title}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                    <span className={cn("rounded px-1.5 py-0.5", STATUS_COLORS[task.status])}>
                      {taskStatusLabels[task.status] || task.status}
                    </span>
                    {due && (
                      <span className="rounded bg-slate-50 px-1.5 py-0.5 text-slate-500">
                        {t("common.due")} {due}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-300" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
