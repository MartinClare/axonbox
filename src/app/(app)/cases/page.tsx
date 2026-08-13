import { prisma } from "@/lib/prisma";
import {
  CATEGORY_LABELS,
  CASE_STATUS_LABELS,
  SEVERITY_LABELS,
  STATUS_COLORS,
  CATEGORY_COLORS,
  SEVERITY_COLORS,
  cn,
  formatDate,
} from "@/lib/labels";
import Link from "next/link";

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
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
      ],
    },
    orderBy: { discoveredAt: "desc" },
    include: { subcontractor: true, assignee: true, evidence: { take: 1 } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="axon-title text-2xl font-semibold">事件管理</h1>
          <p className="text-sm axon-muted">建立 → 指派 → 跟進 → 核驗關閉</p>
        </div>
        <Link href="/capture" className="axon-btn axon-btn-primary">
          ＋ 新增事件
        </Link>
      </div>

      <form className="axon-panel grid gap-2 p-4 md:grid-cols-5">
        <input name="q" defaultValue={sp.q} placeholder="關鍵字" className="axon-input" />
        <select name="category" defaultValue={sp.category || ""} className="axon-input">
          <option value="">全部分類</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="status" defaultValue={sp.status || ""} className="axon-input">
          <option value="">全部狀態</option>
          {Object.entries(CASE_STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="severity" defaultValue={sp.severity || ""} className="axon-input">
          <option value="">全部嚴重度</option>
          {Object.entries(SEVERITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className="axon-btn axon-btn-primary">篩選</button>
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3">事件</th>
              <th className="px-4 py-3">分類</th>
              <th className="px-4 py-3">嚴重度</th>
              <th className="px-4 py-3">位置</th>
              <th className="px-4 py-3">分判</th>
              <th className="px-4 py-3">狀態</th>
              <th className="px-4 py-3">發現時間</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/cases/${c.id}`} className="font-medium text-[var(--axon-blue)]">
                    {c.title}
                  </Link>
                  <div className="text-xs text-slate-400">{c.caseNo}</div>
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
                <td className="px-4 py-3 text-slate-500">{formatDate(c.discoveredAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
