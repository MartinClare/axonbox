"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { SEVERITY_COLORS, STATUS_COLORS, cn } from "@/lib/labels";
import { useI18n } from "@/components/I18nProvider";

type CaseRow = {
  id: string;
  caseNo: string;
  title: string;
  status: string;
  severity: string;
  location: string;
};

export default function FieldCasesPage() {
  const { t, caseStatusLabels, severityLabels } = useI18n();
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<CaseRow[]>("/api/cases").then((res) => {
      if (res.ok) {
        const list = Array.isArray(res.data) ? res.data : [];
        setRows(list.filter((c) => c.status !== "CLOSED"));
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-slate-400">
        <Loader2 className="animate-spin" size={22} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-[var(--axon-ink)]">{t("field.tab.cases")}</h1>
      {rows.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">{t("field.emptyCases")}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <Link
              key={c.id}
              href={`/cases/${c.id}`}
              className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-[var(--axon-line)]"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-slate-400">{c.caseNo}</div>
                <div className="truncate text-sm font-semibold text-[var(--axon-ink)]">{c.title}</div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                  <span className={cn("rounded px-1.5 py-0.5", STATUS_COLORS[c.status])}>
                    {caseStatusLabels[c.status] || c.status}
                  </span>
                  <span className={cn("rounded px-1.5 py-0.5 bg-slate-50", SEVERITY_COLORS[c.severity])}>
                    {severityLabels[c.severity] || c.severity}
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-slate-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
