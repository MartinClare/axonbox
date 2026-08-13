import { formatDate } from "@/lib/labels";

type EventItem = {
  id: string;
  type: string;
  note: string | null;
  createdAt: string | Date;
  actor?: { name: string } | null;
};

const TYPE_LABEL: Record<string, string> = {
  CREATE: "\u5efa\u7acb\u4e8b\u4ef6",
  ASSIGN: "\u6307\u6d3e\u4efb\u52d9",
  PROGRESS: "\u6574\u6539\u9032\u884c\u4e2d",
  REVIEW: "\u63d0\u4ea4\u6838\u9a57",
  CLOSE: "\u4e8b\u4ef6\u95dc\u9589",
  NOTE: "\u5099\u8a3b",
};

export function Timeline({ events }: { events: EventItem[] }) {
  return (
    <ol className="relative space-y-4 border-l border-slate-200 pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-[var(--axon-blue)]" />
          <div className="text-sm font-medium text-slate-800">
            {TYPE_LABEL[e.type] || e.type}
          </div>
          {e.note && <div className="mt-0.5 text-sm text-slate-600">{e.note}</div>}
          <div className="mt-1 text-xs text-slate-400">
            {formatDate(e.createdAt)}
            {e.actor?.name ? ` · ${e.actor.name}` : ""}
          </div>
        </li>
      ))}
      {events.length === 0 && (
        <li className="text-sm text-slate-400">尚無流程記錄</li>
      )}
    </ol>
  );
}
