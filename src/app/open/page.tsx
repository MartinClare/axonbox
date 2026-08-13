"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Copy, Check, Monitor, Smartphone, Wifi, Globe } from "lucide-react";
import { APP_DEMO_EMAIL, APP_DEMO_PASSWORD, APP_NAME } from "@/lib/brand";

export default function OpenPage() {
  const [origin, setOrigin] = useState("");
  const [lanHint, setLanHint] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const o = window.location.origin;
    setOrigin(o);
    // If opened via localhost, hint LAN from hostname when not local
    if (o.includes("localhost") || o.includes("127.0.0.1")) {
      setLanHint("同一 Wi‑Fi 下，用本機區網 IP（例如 http://192.168.x.x:3000）開手機／其他電腦");
    } else {
      setLanHint("目前已是可分享網址，手機與其他電腦直接開啟即可");
    }
  }, []);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-8">
      <div>
        <h1 className="axon-title text-2xl font-semibold">如何開啟 {APP_NAME}</h1>
        <p className="mt-1 text-sm axon-muted">電腦網頁 · 手機網頁 · 手機 App（安裝到主畫面）</p>
      </div>

      <section className="axon-panel space-y-3 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Globe size={15} />
          目前網址
        </h2>
        <p className="break-all rounded-xl bg-[var(--axon-sand)] px-3 py-3 text-sm font-medium text-[var(--axon-ink)]">
          {origin || "…"}
        </p>
        <button
          type="button"
          className="axon-btn axon-btn-primary w-full"
          onClick={() => copy(origin, "origin")}
          disabled={!origin}
        >
          {copied === "origin" ? <Check size={15} /> : <Copy size={15} />}
          {copied === "origin" ? "已複製" : "複製網址分享"}
        </button>
        <p className="text-xs text-slate-500">{lanHint}</p>
      </section>

      <section className="axon-panel space-y-2 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Monitor size={15} />
          電腦穩定版
        </h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>用 Chrome 或 Edge 開啟上方網址</li>
          <li>登入後建議「釘選分頁」或加入書籤</li>
          <li>左側選單為完整功能（最適合桌面）</li>
        </ol>
      </section>

      <section className="axon-panel space-y-2 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Smartphone size={15} />
          手機網頁版
        </h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>手機連同一 Wi‑Fi（或使用分享連結）</li>
          <li>用 Chrome／Safari 開啟同一網址</li>
          <li>底部五鍵：總覽／收件／分析／事件／任務</li>
        </ol>
      </section>

      <section className="axon-panel space-y-2 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Wifi size={15} />
          變成手機 App（{APP_NAME}）
        </h2>
        <p className="text-sm text-slate-700">
          不需上架 App Store。把網頁「加到主畫面」後，圖示名稱就是 {APP_NAME}，全螢幕使用。
        </p>
        <Link href="/install" className="axon-btn axon-btn-ok w-full">
          去安裝 {APP_NAME}
        </Link>
      </section>

      <section className="axon-panel p-5 text-sm text-slate-600">
        <div className="font-medium text-[var(--axon-ink)]">示範帳號</div>
        <p className="mt-1">
          {APP_DEMO_EMAIL}／{APP_DEMO_PASSWORD}
        </p>
        <Link href="/login" className="mt-3 inline-flex text-[var(--axon-blue)]">
          前往登入 →
        </Link>
      </section>
    </div>
  );
}
