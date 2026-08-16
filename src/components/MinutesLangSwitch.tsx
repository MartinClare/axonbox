"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/labels";
import type { MinutesOutputLang } from "@/lib/file-base64";
import { useI18n } from "@/components/I18nProvider";

const OPTION_IDS: MinutesOutputLang[] = ["original", "zh", "en"];

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
  const { t } = useI18n();

  const labels: Record<MinutesOutputLang, string> = {
    original: t("minutes.original"),
    zh: t("minutes.zh"),
    en: t("minutes.en"),
  };

  return (
    <div
      className={cn(
        "inline-flex rounded-md bg-slate-100/90 p-0.5",
        disabled && "opacity-60",
      )}
      title={t("minutes.outHint")}
      role="group"
      aria-label={t("minutes.outLang")}
    >
      {OPTION_IDS.map((id) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(id)}
          className={cn(
            "rounded font-medium transition",
            size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
            value === id
              ? "bg-white text-[var(--axon-ink)] shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          {labels[id]}
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
  const { t } = useI18n();

  return (
    <div
      className={cn(
        "inline-flex flex-wrap items-center gap-2 rounded-xl border border-violet-200/80 bg-violet-50/60 px-2.5 py-1.5",
        disabled && "opacity-70",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[10px] font-medium leading-none text-violet-800/80">
          {t("minutes.label")}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500">{t("minutes.out")}</span>
          <MinutesLangSwitch value={value} onChange={onChange} disabled={disabled} />
        </div>
      </div>
      <div className="h-7 w-px self-center bg-violet-200/90" aria-hidden />
      {children}
    </div>
  );
}
