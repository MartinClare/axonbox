"use client";

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
        "inline-flex rounded-lg bg-slate-100 p-0.5 ring-1 ring-[var(--axon-line)]",
        disabled && "opacity-60",
      )}
      title="輸出語言（預設保留原文，不翻譯）"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-md font-medium transition",
            size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
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
