"use client";

import { cn } from "@/lib/labels";
import type { MinutesProgress } from "@/lib/file-base64";

export function MinutesProgressOverlay({
  progress,
}: {
  progress: MinutesProgress;
}) {
  const pct = Math.max(0, Math.min(100, progress.pct));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <div className="text-sm font-semibold text-[var(--axon-ink)]">處理會議紀錄</div>
        <p className="mt-1 text-xs text-slate-500">{progress.label}</p>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn(
              "h-full rounded-full bg-[#c377e0] transition-[width] duration-300 ease-out",
              pct < 100 && "animate-pulse",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>讀取 → 上傳 → AI 分析</span>
          <span className="font-medium text-purple-800">{Math.round(pct)}%</span>
        </div>
      </div>
    </div>
  );
}
