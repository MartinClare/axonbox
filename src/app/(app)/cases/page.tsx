import { prisma } from "@/lib/prisma";
import {
  STATUS_COLORS,
  CATEGORY_COLORS,
  SEVERITY_COLORS,
  cn,
  formatDate,
  daysRemaining,
} from "@/lib/labels";
import { caseLoopSubtitle, getCaseLoopState } from "@/lib/case-loop";
import { CaseLoopStepper } from "@/components/CaseLoopStepper";
import { getServerUiLocale } from "@/lib/i18n/server";
import { translate, domainLabelMap } from "@/lib/i18n/messages";
import Link from "next/link";

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const locale = await getServerUiLocale();
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const CATEGORY_LABELS = domainLabelMap(locale, "label.category", [
    "SAFETY",
    "QUALITY",
    "PROGRESS",
    "ENVIRONMENT",
    "OTHER",
  ]);
  const CASE_STATUS_LABELS = domainLabelMap(locale, "label.case", [
    "OPEN",
    "ASSIGNED",
    "IN_PROGRESS",
    "PENDING_REVIEW",
    "CLOSED",
  ]);
  const SEVERITY_LABELS = domainLabelMap(locale, "label.severity", ["HIGH", "MEDIUM", "LOW"]);

  const sp = await searchParams;
  const overdueOnly = sp.overdue === "1" || sp.overdue === "true";
  const now = new Date();

  const cases = await prisma.case.findMany({
    where: {
      AND: [
        sp.q
          ? {
              OR: [
                { title: { contains: sp.q } },
                { caseNo: { contains: sp.q } },
                { location: { contains: sp.q } },
              ],
            }
          : {},
        sp.category ? { category: sp.category } : {},
        sp.status ? { status: sp.status } : {},
        sp.severity ? { severity: sp.severity } : {},
        overdueOnly
          ? {
              status: { not: "CLOSED" },
              dueAt: { lt: now },
            }
          : {},
      ],
    },
    orderBy: { discoveredAt: "desc" },
    include: {
      subcontractor: true,
      assignee: true,
      evidence: { select: { id: true, createdAt: true, tagsJson: true } },
      events: { select: { type: true, createdAt: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="axon-title text-2xl font-semibold">{t("cases.title")}</h1>
          <p className="text-sm axon-muted">{caseLoopSubtitle(locale)}</p>
        </div>
        <Link href="/capture" className="axon-btn axon-btn-primary">
          {t("cases.add")}
        </Link>
      </div>

      <form className="axon-panel grid gap-2 p-4 md:grid-cols-6">
        <input name="q" defaultValue={sp.q} placeholder={t("common.keyword")} className="axon-input" />
        <select name="category" defaultValue={sp.category || ""} className="axon-input">
          <option value="">{t("common.allCategories")}</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status || ""} className="axon-input">
          <option value="">{t("common.allStatuses")}</option>
          {Object.entries(CASE_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select name="severity" defaultValue={sp.severity || ""} className="axon-input">
          <option value="">{t("common.allSeverities")}</option>
          {Object.entries(SEVERITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-[var(--axon-line)] bg-white px-3 text-sm text-slate-600">
          <input type="checkbox" name="overdue" value="1" defaultChecked={overdueOnly} />
          {t("common.overdueOnly")}
        </label>
        <button className="axon-btn axon-btn-primary">{t("common.filter")}</button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3">{t("cases.col.case")}</th>
              <th className="px-4 py-3">{t("cases.col.loop")}</th>
              <th className="px-4 py-3">{t("common.category")}</th>
              <th className="px-4 py-3">{t("common.severity")}</th>
              <th className="px-4 py-3">{t("cases.col.location")}</th>
              <th className="px-4 py-3">{t("cases.col.sub")}</th>
              <th className="px-4 py-3">{t("common.status")}</th>
              <th className="px-4 py-3">{t("cases.col.due")}</th>
              <th className="px-4 py-3">{t("cases.col.discovered")}</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => {
              const remain = daysRemaining(c.dueAt);
              const overdue = c.status !== "CLOSED" && remain !== null && remain < 0;
              const loop = getCaseLoopState(
                {
                  status: c.status,
                  assigneeId: c.assigneeId,
                  subcontractorId: c.subcontractorId,
                  evidence: c.evidence,
                  events: c.events,
                },
                locale,
              );
              const currentLabel = loop.steps.find((s) => s.current)?.label || t("loop.close");
              return (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/cases/${c.id}`} className="font-medium text-[var(--axon-blue)]">
                      {c.title}
                    </Link>
                    <div className="text-xs text-slate-400">{c.caseNo}</div>
                  </td>
                  <td className="px-4 py-3">
                    <CaseLoopStepper steps={loop.steps} compact />
                    <div className="mt-1 text-[10px] text-slate-400">
                      {c.status === "CLOSED" ? t("cases.loopDone") : currentLabel}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded px-2 py-0.5 text-xs", CATEGORY_COLORS[c.category])}>
                      {CATEGORY_LABELS[c.category]}
                    </span>
                  </td>
                  <td className={cn("px-4 py-3 font-medium", SEVERITY_COLORS[c.severity])}>
                    {SEVERITY_LABELS[c.severity]}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.location}</td>
                  <td className="px-4 py-3 text-slate-600">{c.subcontractor?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS_COLORS[c.status])}>
                      {CASE_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {remain === null ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-xs",
                          overdue ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {overdue
                          ? t("common.overdueDays", { n: Math.abs(remain) })
                          : t("common.remainDays", { n: remain })}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(c.discoveredAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
