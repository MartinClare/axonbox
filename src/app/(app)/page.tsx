import { prisma } from "@/lib/prisma";
import { KpiCard } from "@/components/KpiCard";
import { CaseCard } from "@/components/CaseCard";
import { CategoryDonut, TrendLine } from "@/components/Charts";
import { DigestCopyButton } from "@/components/DigestCopyButton";
import Link from "next/link";
import {
  Camera,
  Inbox,
  CheckSquare,
  FileBarChart,
  BookOpen,
} from "lucide-react";
import { getServerUiLocale } from "@/lib/i18n/server";
import { translate, domainLabelMap } from "@/lib/i18n/messages";

function pctChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function OverviewPage() {
  try {
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
    const dateLocale = locale === "en" ? "en-HK" : "zh-HK";

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const project = await prisma.project.findFirst();

    const [
      safetyOpen,
      qualityOpen,
      overdueCases,
      agingMinutes,
      pendingInspect,
      activeCases,
      prevActive,
      pendingTasks,
      prevPending,
      todayNew,
      prevTodayNew,
      closedCases,
      closedWithDates,
      byCategory,
      latest,
      overdueList,
      agingList,
    ] = await Promise.all([
      prisma.case.count({
        where: { category: "SAFETY", status: { not: "CLOSED" } },
      }),
      prisma.case.count({
        where: { category: "QUALITY", status: { not: "CLOSED" } },
      }),
      prisma.case.count({
        where: { status: { not: "CLOSED" }, dueAt: { lt: now } },
      }),
      prisma.task.count({
        where: {
          meetingId: { not: null },
          status: { not: "DONE" },
          dueAt: { lt: now },
          archived: false,
        },
      }),
      prisma.checklistRun.count({ where: { status: "IN_PROGRESS" } }),
      prisma.case.count({ where: { status: { not: "CLOSED" } } }),
      prisma.case.count({
        where: { status: { not: "CLOSED" }, createdAt: { lt: weekAgo } },
      }),
      prisma.task.count({
        where: { status: { in: ["PENDING", "IN_PROGRESS"] }, meetingId: null },
      }),
      prisma.task.count({
        where: {
          status: { in: ["PENDING", "IN_PROGRESS"] },
          meetingId: null,
          createdAt: { lt: weekAgo },
        },
      }),
      prisma.case.count({ where: { discoveredAt: { gte: startOfToday } } }),
      prisma.case.count({
        where: {
          discoveredAt: {
            gte: new Date(startOfToday.getTime() - 7 * 86400000),
            lt: new Date(startOfToday.getTime() - 6 * 86400000),
          },
        },
      }),
      prisma.case.count({ where: { status: "CLOSED" } }),
      prisma.case.findMany({
        where: { status: "CLOSED", closedAt: { not: null } },
        select: { discoveredAt: true, closedAt: true },
        take: 100,
      }),
      prisma.case.groupBy({ by: ["category"], _count: { _all: true } }),
      prisma.case.findMany({
        orderBy: { discoveredAt: "desc" },
        take: 5,
        include: { evidence: { take: 1 } },
      }),
      prisma.case.findMany({
        where: { status: { not: "CLOSED" }, dueAt: { lt: now } },
        orderBy: { dueAt: "asc" },
        take: 6,
        select: { caseNo: true, title: true, category: true, status: true },
      }),
      prisma.task.findMany({
        where: {
          meetingId: { not: null },
          status: { not: "DONE" },
          dueAt: { lt: now },
          archived: false,
        },
        orderBy: { dueAt: "asc" },
        take: 6,
        select: { title: true, dueAt: true, meeting: { select: { title: true } } },
      }),
    ]);

    const avgCloseDays =
      closedWithDates.length === 0
        ? 0
        : Math.round(
            (closedWithDates.reduce((sum, c) => {
              const ms = (c.closedAt?.getTime() || 0) - c.discoveredAt.getTime();
              return sum + ms / 86400000;
            }, 0) /
              closedWithDates.length) *
              10,
          ) / 10;

    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      const [created, closed] = await Promise.all([
        prisma.case.count({ where: { discoveredAt: { gte: day, lt: next } } }),
        prisma.case.count({ where: { closedAt: { gte: day, lt: next } } }),
      ]);
      trend.push({
        date: `${day.getMonth() + 1}/${day.getDate()}`,
        created,
        closed,
      });
    }

    const digestLines = [
      t("home.digest.title", {
        project: project?.name || t("home.digest.projectFallback"),
        date: now.toLocaleDateString(dateLocale),
      }),
      t("home.digest.line1", {
        safety: safetyOpen,
        quality: qualityOpen,
        overdue: overdueCases,
      }),
      t("home.digest.line2", {
        aging: agingMinutes,
        inspect: pendingInspect,
      }),
      "",
      overdueList.length
        ? t("home.digest.overdueHeader") +
          "\n" +
          overdueList
            .map(
              (c) =>
                `• ${c.caseNo} ${c.title}（${CATEGORY_LABELS[c.category] || c.category}/${CASE_STATUS_LABELS[c.status] || c.status}）`,
            )
            .join("\n")
        : t("home.digest.overdueNone"),
      "",
      agingList.length
        ? t("home.digest.agingHeader") +
          "\n" +
          agingList
            .map((task) => `• ${task.title}${task.meeting?.title ? `（${task.meeting.title}）` : ""}`)
            .join("\n")
        : t("home.digest.agingNone"),
    ];

    return (
      <div className="axon-page">
        <div className="axon-page-header">
          <div>
            <p className="axon-kicker">{t("home.kicker")}</p>
            <h1 className="axon-title mt-1 text-2xl font-semibold sm:text-3xl">{t("home.title")}</h1>
            <p className="axon-muted mt-1.5 text-sm">{t("home.subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DigestCopyButton text={digestLines.join("\n")} />
            <Link href="/capture" className="axon-btn axon-btn-accent px-5">
              <Camera size={15} />
              {t("home.capture")}
            </Link>
          </div>
        </div>

        <div className="axon-quick-grid">
          {[
            { href: "/inbox", label: t("nav.inbox"), icon: Inbox },
            { href: "/checklist", label: t("nav.checklist"), icon: CheckSquare },
            { href: "/reports", label: t("nav.reports"), icon: FileBarChart },
            { href: "/knowledge", label: t("nav.knowledge"), icon: BookOpen },
          ].map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.href} href={a.href} className="axon-quick-link">
                <span className="axon-quick-ico">
                  <Icon size={15} />
                </span>
                {a.label}
              </Link>
            );
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link href="/cases?category=SAFETY" className="block">
            <KpiCard
              label={t("home.kpi.safetyOpen")}
              value={safetyOpen}
              hint={t("home.kpi.safetyHint")}
            />
          </Link>
          <Link href="/cases?category=QUALITY" className="block">
            <KpiCard
              label={t("home.kpi.qualityOpen")}
              value={qualityOpen}
              hint={t("home.kpi.qualityHint")}
            />
          </Link>
          <Link href="/cases?overdue=1" className="block">
            <KpiCard
              label={t("home.kpi.overdueCases")}
              value={overdueCases}
              hint={t("home.kpi.overdueHint")}
            />
          </Link>
          <Link href="/tasks" className="block">
            <KpiCard
              label={t("home.kpi.agingMinutes")}
              value={agingMinutes}
              hint={t("home.kpi.agingHint")}
            />
          </Link>
        </div>

        {(safetyOpen > 0 || pendingInspect > 0) && (
          <div className="axon-panel flex flex-wrap items-center justify-between gap-3 border-l-[3px] border-l-[var(--axon-danger)] px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-[var(--axon-ink)]">
                {safetyOpen > 0
                  ? t("home.alert.safetyOpen", { count: safetyOpen })
                  : t("home.alert.inspectOpen", { count: pendingInspect })}
              </div>
              <p className="axon-muted mt-0.5 text-xs">
                {pendingInspect > 0
                  ? t("home.alert.inspectExtra", { count: pendingInspect })
                  : t("home.alert.priority")}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {pendingInspect > 0 && (
                <Link href="/checklist" className="text-sm font-semibold text-[var(--axon-blue)]">
                  {t("home.alert.checklistLink")}
                </Link>
              )}
              {safetyOpen > 0 && (
                <Link
                  href="/cases?category=SAFETY"
                  className="text-sm font-semibold text-[var(--axon-danger)]"
                >
                  {t("home.alert.safetyLink")}
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={t("home.kpi.activeCases")}
            value={activeCases}
            delta={pctChange(activeCases, prevActive)}
            hint={t("home.kpi.vsLastWeek")}
          />
          <KpiCard
            label={t("home.kpi.pendingTasks")}
            value={pendingTasks}
            delta={pctChange(pendingTasks, prevPending)}
            hint={t("home.kpi.vsLastWeek")}
          />
          <KpiCard
            label={t("home.kpi.todayNew")}
            value={todayNew}
            delta={pctChange(todayNew, prevTodayNew)}
            hint={t("home.kpi.vsSameDay")}
          />
          <KpiCard
            label={t("home.kpi.avgClose")}
            value={t("home.kpi.days", { days: avgCloseDays })}
            hint={t("home.kpi.closedCount", { count: closedCases })}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.2fr_0.9fr]">
          <section className="axon-panel p-5">
            <h2 className="text-sm font-semibold text-[var(--axon-ink)]">
              {t("home.section.byCategory")}
            </h2>
            <CategoryDonut
              data={byCategory.map((c) => ({
                category: c.category,
                count: c._count._all,
              }))}
            />
          </section>

          <section className="axon-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--axon-ink)]">
                {t("home.section.latest")}
              </h2>
              <Link href="/cases" className="text-xs text-[var(--axon-steel)]">
                {t("home.section.all")}
              </Link>
            </div>
            <div className="space-y-2">
              {latest.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  {t("home.empty.latest")}{" "}
                  <Link href="/capture" className="text-[var(--axon-blue)]">
                    {t("home.empty.capture")}
                  </Link>
                </p>
              ) : (
                latest.map((c) => <CaseCard key={c.id} item={c} />)
              )}
            </div>
          </section>

          <section className="axon-panel p-5">
            <h2 className="mb-2 text-sm font-semibold text-[var(--axon-ink)]">
              {t("home.section.trend")}
            </h2>
            <TrendLine data={trend} />
          </section>
        </div>
      </div>
    );
  } catch (err) {
    console.error("Overview failed", err);
    const locale = await getServerUiLocale().catch(() => "zh-Hant" as const);
    const t = (key: string) => translate(locale, key);
    return (
      <div className="axon-panel mx-auto max-w-lg space-y-3 p-8 text-center">
        <h1 className="axon-title text-xl font-semibold">{t("home.error.title")}</h1>
        <p className="text-sm axon-muted">{t("home.error.body")}</p>
        <Link href="/" className="axon-btn axon-btn-primary inline-flex">
          {t("home.error.retry")}
        </Link>
      </div>
    );
  }
}
