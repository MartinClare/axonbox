"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/labels";
import type { MinutesOutputLang } from "@/lib/file-base64";

const OPTIONS: Array<{ id: MinutesOutputLang; label: string }> = [
  { id: "original", label: "原文" },
  { id: "zh", label: "中文" },
  { id: "en", label: "English" },
];

export function MinutesLangSwitch({
  value,
  onChange,
  disabled,
  size = "sm",
}: {
  value: MinutesOutputLang;
  onChange: (v: MinutesOutputLang) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "inline-flex rounded-md bg-slate-100/90 p-0.5",
        disabled && "opacity-60",
      )}
      title="輸出語言（預設保留原文，不翻譯）"
      role="group"
      aria-label="會議紀錄輸出語言"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded font-medium transition",
            size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
            value === opt.id
              ? "bg-white text-[var(--axon-ink)] shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Language + upload bound together as one「會議紀錄」control. */
export function MinutesUploadGroup({
  value,
  onChange,
  disabled,
  children,
  className,
}: {
  value: MinutesOutputLang;
  onChange: (v: MinutesOutputLang) => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-2 rounded-xl border border-violet-200/80 bg-violet-50/60 px-2.5 py-1.5",
        disabled && "opacity-70",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[10px] font-medium leading-none text-violet-800/80">會議紀錄</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500">輸出</span>
          <MinutesLangSwitch value={value} onChange={onChange} disabled={disabled} />
        </div>
      </div>
      <div className="h-7 w-px self-center bg-violet-200/90" aria-hidden />
      {children}
    </div>
  );
}
