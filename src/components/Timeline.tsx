"use client";

import { formatDate } from "@/lib/labels";
import { useI18n } from "@/components/I18nProvider";

type EventItem = {
  id: string;
  type: string;
  note: string | null;
  createdAt: string | Date;
  actor?: { name: string } | null;
};

const TYPE_KEYS = ["CREATE", "ASSIGN", "PROGRESS", "REVIEW", "CLOSE", "NOTE"] as const;

export function Timeline({ events }: { events: EventItem[] }) {
  const { t } = useI18n();

  function typeLabel(type: string) {
    if ((TYPE_KEYS as readonly string[]).includes(type)) {
      return t(`timeline.${type}`);
    }
    return type;
  }

  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-[var(--axon-blue)]" />
          <div className="text-sm font-medium text-slate-800">{typeLabel(e.type)}</div>
          {e.note && <div className="mt-0.5 text-sm text-slate-600">{e.note}</div>}
          <div className="mt-1 text-xs text-slate-400">
            {formatDate(e.createdAt)}
            {e.actor?.name ? ` · ${e.actor.name}` : ""}
          </div>
        </li>
      ))}
      {events.length === 0 && <li className="text-sm text-slate-400">{t("timeline.empty")}</li>}
    </ol>
  );
}
