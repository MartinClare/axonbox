import { prisma } from "@/lib/prisma";
import { KpiCard } from "@/components/KpiCard";
import { CaseCard } from "@/components/CaseCard";
import { CategoryDonut, TrendLine } from "@/components/Charts";
import Link from "next/link";
import {
  Camera,
  Inbox,
  CheckSquare,
  FileBarChart,
  BookOpen,
} from "lucide-react";

function pctChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function OverviewPage() {
  try {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const safetyOpen = await prisma.case.count({
      where: { category: "SAFETY", status: { not: "CLOSED" } },
    });

    const [
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
    ] = await Promise.all([
      prisma.case.count({ where: { status: { not: "CLOSED" } } }),
      prisma.case.count({
        where: { status: { not: "CLOSED" }, createdAt: { lt: weekAgo } },
      }),
      prisma.task.count({ where: { status: { in: ["PENDING", "IN_PROGRESS"] } } }),
      prisma.task.count({
        where: {
          status: { in: ["PENDING", "IN_PROGRESS"] },
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

    return (
      <div className="axon-page">
        <div className="axon-page-header">
          <div>
            <p className="axon-kicker">Command Center</p>
            <h1 className="axon-title mt-1 text-2xl font-semibold sm:text-3xl">總覽</h1>
            <p className="axon-muted mt-1.5 text-sm">一屏看清：風險、進度、待辦</p>
          </div>
          <Link href="/capture" className="axon-btn axon-btn-accent px-5">
            <Camera size={15} />
            拍照分析場地
          </Link>
        </div>

        <div className="axon-quick-grid">
          {[
            { href: "/inbox", label: "訊息收件", icon: Inbox },
            { href: "/checklist", label: "現場點檢", icon: CheckSquare },
            { href: "/reports", label: "出報告", icon: FileBarChart },
            { href: "/knowledge", label: "工程提問", icon: BookOpen },
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

        {safetyOpen > 0 && (
          <div className="axon-panel flex flex-wrap items-center justify-between gap-3 border-l-[3px] border-l-[var(--axon-danger)] px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-[var(--axon-ink)]">
                {safetyOpen} 項安全漏洞尚未關閉
              </div>
              <p className="axon-muted mt-0.5 text-xs">優先處理高風險項，避免現場停工風險</p>
            </div>
            <Link
              href="/cases?category=SAFETY&status=OPEN"
              className="text-sm font-semibold text-[var(--axon-danger)]"
            >
              查看安全事件 →
            </Link>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="進行中事件"
            value={activeCases}
            delta={pctChange(activeCases, prevActive)}
            hint="較上週"
          />
          <KpiCard
            label="待處理任務"
            value={pendingTasks}
            delta={pctChange(pendingTasks, prevPending)}
            hint="較上週"
          />
          <KpiCard
            label="今日新增"
            value={todayNew}
            delta={pctChange(todayNew, prevTodayNew)}
            hint="較上週同日"
          />
          <KpiCard label="平均關閉" value={`${avgCloseDays}天`} hint={`${closedCases} 已完成`} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.2fr_0.9fr]">
          <section className="axon-panel p-5">
            <h2 className="text-sm font-semibold text-[var(--axon-ink)]">分類分佈</h2>
            <CategoryDonut
              data={byCategory.map((c) => ({
                category: c.category,
                count: c._count._all,
              }))}
            />
          </section>

          <section className="axon-panel p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--axon-ink)]">最新事件</h2>
              <Link href="/cases" className="text-xs text-[var(--axon-steel)]">
                全部
              </Link>
            </div>
            <div className="space-y-2">
              {latest.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  尚無事件 · 可先{" "}
                  <Link href="/capture" className="text-[var(--axon-blue)]">
                    拍照分析
                  </Link>
                </p>
              ) : (
                latest.map((c) => <CaseCard key={c.id} item={c} />)
              )}
            </div>
          </section>

          <section className="axon-panel p-5">
            <h2 className="mb-2 text-sm font-semibold text-[var(--axon-ink)]">近 7 日趨勢</h2>
            <TrendLine data={trend} />
          </section>
        </div>
      </div>
    );
  } catch (err) {
    console.error("Overview failed", err);
    return (
      <div className="axon-panel mx-auto max-w-lg space-y-3 p-8 text-center">
        <h1 className="axon-title text-xl font-semibold">總覽暫時無法載入</h1>
        <p className="text-sm axon-muted">資料庫可能未就緒。請重新整理，或執行 npm run db:setup。</p>
        <Link href="/" className="axon-btn axon-btn-primary inline-flex">
          重試
        </Link>
      </div>
    );
  }
}
