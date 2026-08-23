"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Camera,
  FolderKanban,
  Images,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Monitor,
} from "lucide-react";
import { APP_NAME } from "@/lib/brand";
import { cn } from "@/lib/labels";
import { useI18n } from "@/components/I18nProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

const tabs = [
  { href: "/m", labelKey: "field.tab.home", icon: LayoutDashboard, match: (p: string) => p === "/m" },
  { href: "/m/inbox", labelKey: "field.tab.whatsapp", icon: MessageCircle, match: (p: string) => p.startsWith("/m/inbox") },
  { href: "/m/capture", labelKey: "field.tab.photo", icon: Camera, match: (p: string) => p.startsWith("/m/capture"), primary: true },
  { href: "/m/evidence", labelKey: "field.tab.evidence", icon: Images, match: (p: string) => p.startsWith("/m/evidence") },
  { href: "/m/cases", labelKey: "field.tab.cases", icon: FolderKanban, match: (p: string) => p.startsWith("/m/cases") },
];

function titleFor(pathname: string, t: (k: string) => string) {
  if (pathname.startsWith("/m/capture")) return t("field.tab.photo");
  if (pathname.startsWith("/m/inbox")) return t("field.inboxTitle");
  if (pathname.startsWith("/m/evidence")) return t("field.tab.evidence");
  if (pathname.startsWith("/m/cases")) return t("field.tab.cases");
  if (pathname.startsWith("/m/tasks")) return t("field.myTasks");
  return t("field.homeTitle");
}

export function FieldShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const session = useSession();
  const { t } = useI18n();
  const user = session.data?.user;
  const camera = pathname.startsWith("/m/capture");

  return (
    <div className={cn("mx-auto flex min-h-dvh w-full max-w-lg flex-col", camera ? "bg-black" : "bg-[var(--background)]")}>
      <header
        className={cn(
          "z-40 flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white",
          camera
            ? "absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent"
            : "sticky top-0 border-b border-white/10 bg-[var(--axon-brand)]",
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-lg object-cover ring-2 ring-[var(--axon-signal)]/70" />
          <div className="min-w-0">
            <div className="text-sm font-semibold">{APP_NAME}</div>
            <div className="truncate text-[10px] font-medium text-[var(--axon-signal)]">
              {titleFor(pathname, t)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {!camera && <ThemeToggle compact />}
          <Link
            href="/?desktop=1"
            className="rounded-lg p-2 text-white/80 hover:bg-white/10"
            title={t("field.desktop")}
          >
            <Monitor size={18} />
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-lg p-2 text-white/80 hover:bg-white/10"
            title={t("nav.logout")}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          camera
            ? "pb-[calc(4.75rem+env(safe-area-inset-bottom))]"
            : "px-4 py-4 pb-[calc(5.75rem+env(safe-area-inset-bottom))]",
        )}
      >
        {children}
      </main>

      <p className="sr-only">{user?.name}</p>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--axon-line)] bg-[var(--axon-white)]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_rgba(0,48,73,0.06)] backdrop-blur">
        <div className="mx-auto grid max-w-lg grid-cols-5 px-0.5 py-1.5">
          {tabs.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
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
                    item.primary && "bg-[var(--axon-accent)] text-white shadow-md shadow-orange-900/15",
                    item.primary && active && "ring-2 ring-[var(--axon-signal)]",
                    !item.primary && active && "bg-[var(--axon-sand)] text-[var(--axon-ink)]",
                  )}
                >
                  <Icon size={item.primary ? 16 : 17} strokeWidth={1.75} />
                </span>
                {t(item.labelKey)}
                {active && !item.primary && (
                  <span className="absolute -bottom-0.5 h-0.5 w-4 rounded-full bg-[var(--axon-signal)]" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
