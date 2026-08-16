"use client";

import { useState } from "react";
import { useI18n } from "@/components/I18nProvider";

export function DigestCopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="axon-btn axon-btn-ghost min-h-8 px-3 text-xs"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setMsg(t("home.digestCopied"));
          } catch {
            setMsg(t("home.digestFail"));
          }
        }}
      >
        {t("home.copyDigest")}
      </button>
      {msg && <span className="text-xs text-emerald-700">{msg}</span>}
    </div>
  );
}
