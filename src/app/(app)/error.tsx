"use client";

import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
      <h1 className="axon-title text-xl font-semibold">頁面暫時無法載入</h1>
      <p className="text-sm axon-muted">
        {error?.message?.slice(0, 160) || "發生未預期錯誤，請重試或重新登入。"}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={reset} className="axon-btn axon-btn-primary">
          重試
        </button>
        <Link href="/" className="axon-btn axon-btn-ghost">
          回總覽
        </Link>
        <Link href="/login" className="axon-btn axon-btn-ghost">
          重新登入
        </Link>
      </div>
    </div>
  );
}
