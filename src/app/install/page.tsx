"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Share,
  MoreVertical,
  Plus,
  Smartphone,
  Monitor,
  Wifi,
  CheckCircle2,
} from "lucide-react";
import { APP_DEMO_EMAIL, APP_DEMO_PASSWORD, APP_NAME, APP_TAGLINE } from "@/lib/brand";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPage() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [done, setDone] = useState(false);
  const [origin, setOrigin] = useState("");
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    );
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setDone(true);
    setDeferred(null);
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-8 pb-16">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt={APP_NAME}
            className="mx-auto h-20 w-20 rounded-[22px] shadow-md"
          />
          <h1 className="axon-title mt-4 text-2xl font-semibold">安裝 {APP_NAME}</h1>
          <p className="axon-muted mt-2 text-sm leading-relaxed">{APP_TAGLINE}</p>
          <p className="mt-1 text-xs text-slate-400">主畫面圖示 · 全螢幕 · 免上架商店</p>
        </div>

        {standalone && (
          <div className="axon-panel flex items-center gap-2 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2 size={16} />
            你已在 App 模式開啟 {APP_NAME}
          </div>
        )}

        <section className="axon-panel space-y-3 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--axon-ink)]">
            <Smartphone size={15} />
            手機一鍵安裝（Android Chrome）
          </h2>
          {done ? (
            <p className="text-sm text-emerald-700">
              已安裝。請到主畫面點開「{APP_NAME}」圖示。
            </p>
          ) : deferred ? (
            <button onClick={install} className="axon-btn axon-btn-primary w-full">
              <Smartphone size={16} />
              安裝 {APP_NAME} 到手機
            </button>
          ) : (
            <p className="text-sm text-slate-600">
              若沒有安裝按鈕，請用 <b>Chrome</b> 開啟本頁，或看下方手動步驟。
            </p>
          )}
          {origin && (
            <p className="break-all rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
              網址：{origin}
            </p>
          )}
        </section>

        <section className="axon-panel space-y-4 p-5">
          <h2 className="text-sm font-semibold text-[var(--axon-ink)]">iPhone／iPad（Safari）</h2>
          <ol className="space-y-3 text-sm text-slate-700">
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <Share size={14} />
              </span>
              <span className="pt-1">點底部分享按鈕</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <Plus size={14} />
              </span>
              <span className="pt-1">選擇「加入主畫面」</span>
            </li>
            <li className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/icon-192.png"
                alt=""
                className="h-8 w-8 shrink-0 rounded-lg object-cover"
              />
              <span className="pt-1">名稱確認為 {APP_NAME}，加入後即可當 App 使用</span>
            </li>
          </ol>
        </section>

        <section className="axon-panel space-y-4 p-5">
          <h2 className="text-sm font-semibold text-[var(--axon-ink)]">Android 手動安裝</h2>
          <ol className="space-y-3 text-sm text-slate-700">
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <MoreVertical size={14} />
              </span>
              <span className="pt-1">Chrome 右上角 ⋮</span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <Plus size={14} />
              </span>
              <span className="pt-1">選「安裝應用程式」或「加到主畫面」</span>
            </li>
          </ol>
        </section>

        <section className="axon-panel space-y-3 p-5 text-sm text-slate-600">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--axon-ink)]">
            <Monitor size={15} />
            電腦網頁版
          </h2>
          <p>任何電腦用 Chrome／Edge 開啟同一網址即可（建議加入書籤）。</p>
          <p className="text-xs text-slate-400">
            帳號：{APP_DEMO_EMAIL}／{APP_DEMO_PASSWORD}
          </p>
          <Link href="/open" className="axon-btn axon-btn-ghost w-full">
            <Wifi size={15} />
            查看開啟方式／分享連結
          </Link>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <Link href="/login" className="axon-btn axon-btn-primary">
            登入使用
          </Link>
          <Link href="/capture" className="axon-btn axon-btn-ghost">
            直接去分析
          </Link>
        </div>
      </div>
    </div>
  );
}
