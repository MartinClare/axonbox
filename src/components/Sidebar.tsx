"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  FileText,
  Images,
  BarChart3,
  Camera,
  Settings,
  LogOut,
  Users,
  Menu,
  X,
  Inbox,
  Download,
  Wifi,
  CheckSquare,
  BookOpen,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/labels";
import { APP_NAME } from "@/lib/brand";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const navGroups: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "日常作業",
    items: [
      { href: "/", label: "總覽", icon: LayoutDashboard },
      { href: "/inbox", label: "訊息收件", icon: Inbox },
      { href: "/capture", label: "場地分析", icon: Camera },
      { href: "/cases", label: "事件", icon: FolderKanban },
      { href: "/tasks", label: "任務", icon: ListChecks },
      { href: "/checklist", label: "Checklist", icon: CheckSquare },
    ],
  },
  {
    title: "記錄與輸出",
    items: [
      { href: "/evidence", label: "證據", icon: Images },
      { href: "/daily-reports", label: "日報", icon: FileText },
      { href: "/reports", label: "報表", icon: BarChart3 },
      { href: "/knowledge", label: "工程提問", icon: BookOpen },
    ],
  },
  {
    title: "基礎資料",
    items: [
      { href: "/directory", label: "人員與公司", icon: Users },
      { href: "/settings", label: "設定", icon: Settings },
      { href: "/install", label: "安裝 App", icon: Download },
      { href: "/open", label: "開啟方式", icon: Wifi },
    ],
  },
];

const flatNav = navGroups.flatMap((g) => g.items);

const mobileTabs: NavItem[] = [
  { href: "/", label: "總覽", icon: LayoutDashboard },
  { href: "/inbox", label: "收件", icon: Inbox },
  { href: "/capture", label: "分析", icon: Camera },
  { href: "/cases", label: "事件", icon: FolderKanban },
  { href: "/tasks", label: "任務", icon: ListChecks },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-8 w-8 rounded-lg text-xs" : "h-10 w-10 rounded-xl text-sm";
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/icon-192.png"
          alt=""
          className={cn(box, "object-cover ring-2 ring-[var(--axon-signal)]/80")}
        />
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--axon-accent)] ring-2 ring-[var(--axon-ink)]" />
      </div>
      <div>
        <div className="text-[15px] font-semibold tracking-wide">{APP_NAME}</div>
        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--axon-signal)]">
          Site Ops
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const session = useSession();
  const user = session?.data?.user;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const navLinks = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
      {navGroups.map((group) => (
        <div key={group.title}>
          <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            {group.title}
          </div>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/55 hover:bg-white/6 hover:text-white",
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[var(--axon-signal)]" />
                  )}
                  <Icon size={16} strokeWidth={1.75} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const userBlock = (
    <div className="border-t border-white/10 px-4 py-4">
      <div className="mb-3 text-xs text-white/60">
        {user?.name || "使用者"}
        <div className="truncate text-white/30">{user?.email}</div>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-white/55 transition hover:bg-white/6 hover:text-white"
      >
        <LogOut size={15} />
        登出
      </button>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col bg-[var(--axon-ink)] text-white md:flex">
        <div className="border-b border-white/10 px-5 py-6">
          <BrandMark />
        </div>
        <div className="mx-4 mt-4 h-1 rounded-full bg-gradient-to-r from-[var(--axon-danger)] via-[var(--axon-accent)] to-[var(--axon-signal)] opacity-90" />
        <div className="mt-3 flex-1 flex flex-col overflow-hidden">{navLinks}</div>
        {userBlock}
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-white/10 bg-[var(--axon-ink)] px-4 py-3 text-white md:hidden">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt=""
            className="h-8 w-8 rounded-lg object-cover ring-2 ring-[var(--axon-signal)]/70"
          />
          <div>
            <div className="text-sm font-semibold">{APP_NAME}</div>
            <div className="text-[10px] font-medium text-[var(--axon-signal)]">
              {flatNav.find((n) => isActive(pathname, n.href))?.label || "行動版"}
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label="開啟選單"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2.5 text-white/80 hover:bg-white/10"
        >
          <Menu size={20} />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--axon-ink)]/55 backdrop-blur-[2px]"
            aria-label="關閉選單"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 right-0 flex w-[min(86vw,300px)] flex-col bg-[var(--axon-ink)] text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <BrandMark size="sm" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-white/70 hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            {navLinks}
            {userBlock}
          </aside>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--axon-line)] bg-[var(--axon-white)]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_rgba(0,48,73,0.06)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 px-0.5 py-1.5">
          {mobileTabs.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const primary = item.href === "/capture";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-xl px-0.5 py-1 text-[10px] font-semibold transition",
                  active ? "text-[var(--axon-ink)]" : "text-[var(--axon-steel)]/70",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full transition",
                    primary &&
                      "bg-[var(--axon-accent)] text-white shadow-md shadow-orange-900/15",
                    primary && active && "ring-2 ring-[var(--axon-signal)]",
                    !primary && active && "bg-[var(--axon-sand)] text-[var(--axon-ink)]",
                  )}
                >
                  <Icon size={primary ? 16 : 17} strokeWidth={1.75} />
                </span>
                {item.label}
                {active && !primary && (
                  <span className="absolute -bottom-0.5 h-0.5 w-4 rounded-full bg-[var(--axon-signal)]" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
