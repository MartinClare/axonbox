import { cn } from "@/lib/labels";

export function KpiCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string | number;
  delta?: number | null;
  hint?: string;
}) {
  const up = delta !== undefined && delta !== null && delta >= 0;
  return (
    <div className="axon-panel axon-panel-signal overflow-hidden px-5 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--axon-steel)]">
        {label}
      </div>
      <div className="axon-title mt-3 text-3xl font-semibold tabular-nums tracking-tight">
        {value}
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {delta !== undefined && delta !== null && (
          <span
            className={cn(
              "font-semibold",
              up ? "text-[var(--axon-ok)]" : "text-[var(--axon-danger)]",
            )}
          >
            {up ? "+" : ""}
            {delta}%
          </span>
        )}
        {hint && <span className="axon-muted">{hint}</span>}
      </div>
    </div>
  );
}
