"use client";

import { cn } from "@/lib/labels";
import { useI18n } from "@/components/I18nProvider";
import {
  type CaseLoopNextAction,
  type CaseLoopStep,
  nextActionCopy,
} from "@/lib/case-loop";

export function CaseLoopStepper({
  steps,
  compact,
  className,
}: {
  steps: CaseLoopStep[];
  compact?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  if (compact) {
    return (
      <div className={cn("flex items-center gap-1", className)} title={steps.map((s) => s.label).join(" → ")}>
        {steps.map((s, i) => (
          <span key={s.id} className="flex items-center gap-1">
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                s.done && "bg-emerald-500",
                s.current && !s.done && "bg-[var(--axon-blue)] ring-2 ring-[var(--axon-blue)]/30",
                !s.done && !s.current && "bg-slate-200",
              )}
              aria-label={`${s.label}${s.done ? t("loop.doneAria") : s.current ? t("loop.currentAria") : ""}`}
            />
            {i < steps.length - 1 && <span className="h-px w-2 bg-slate-200" />}
          </span>
        ))}
      </div>
    );
  }

  return (
    <ol className={cn("grid grid-cols-4 gap-2", className)}>
      {steps.map((s, i) => (
        <li key={s.id} className="min-w-0">
          <div
            className={cn(
              "flex flex-col items-center rounded-xl border px-2 py-3 text-center",
              s.done && "border-emerald-200 bg-emerald-50",
              s.current && "border-[var(--axon-blue)] bg-[var(--axon-blue)]/5 shadow-sm",
              !s.done && !s.current && "border-slate-200 bg-white",
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                s.done && "bg-emerald-600 text-white",
                s.current && !s.done && "bg-[var(--axon-blue)] text-white",
                !s.done && !s.current && "bg-slate-100 text-slate-500",
              )}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <span
              className={cn(
                "mt-1.5 text-xs font-medium",
                s.done && "text-emerald-800",
                s.current && "text-[var(--axon-navy)]",
                !s.done && !s.current && "text-slate-400",
              )}
            >
              {s.label}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function CaseLoopNextPanel({
  action,
  busy,
  onAction,
  className,
}: {
  action: CaseLoopNextAction;
  busy?: boolean;
  onAction: (action: CaseLoopNextAction) => void;
  className?: string;
}) {
  const { locale } = useI18n();
  const copy = nextActionCopy(action, locale);
  if (!copy.cta) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--axon-blue)]/25 bg-[var(--axon-blue)]/5 px-4 py-3",
        action === "pack" && "border-emerald-200 bg-emerald-50",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[var(--axon-navy)]">{copy.title}</div>
        <p className="mt-0.5 text-xs text-slate-600">{copy.body}</p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => onAction(action)}
        className={cn(
          "shrink-0 rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50",
          action === "pack" || action === "close"
            ? "bg-emerald-600 hover:bg-emerald-700"
            : "bg-[var(--axon-blue)] hover:opacity-90",
        )}
      >
        {copy.cta}
      </button>
    </div>
  );
}
