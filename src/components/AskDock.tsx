"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, MessageCircleQuestion, Minimize2, Sparkles, X } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/labels";
import { useI18n } from "@/components/I18nProvider";

type Citation = {
  title: string;
  source: string;
  page: string | number;
  section?: string;
  url: string;
};

const QUICK_ZH = [
  "什麼是 XPMS？",
  "AN 要提前多久提交？",
  "圍板／圍欄有什麼安全注意？",
  "混凝土澆置前要檢查什麼？",
];

const QUICK_EN = [
  "What is XPMS?",
  "How far ahead must AN be submitted?",
  "Hoarding / fencing safety tips?",
  "What to check before concreting?",
];

/**
 * Global engineering ask dock — HyD/XPMS + general site engineering.
 */
export function AskDock() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [mode, setMode] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const quick = locale === "en" ? QUICK_EN : QUICK_ZH;

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [open]);

  async function ask(text?: string) {
    const question = (text || q).trim();
    if (!question) return;
    setQ(question);
    setBusy(true);
    setError("");
    setAnswer("");
    setCitations([]);
    setMode("");
    const res = await apiFetch<{
      answer: string;
      citations: Citation[];
      mode?: string;
      mock?: boolean;
    }>("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error || t("ask.fail"));
      return;
    }
    setAnswer(res.data?.answer || "");
    setCitations(res.data?.citations || []);
    setMode(res.data?.mode || "");
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-[4.75rem] right-4 z-40 flex items-center gap-2 rounded-full bg-[var(--axon-ink)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[rgba(0,48,73,0.28)] ring-2 ring-[var(--axon-signal)] transition hover:bg-[#02445f] md:bottom-6 md:right-6"
          aria-label={t("ask.fabAria")}
        >
          <MessageCircleQuestion size={18} />
          <span className="hidden sm:inline">{t("ask.fab")}</span>
        </button>
      )}

      {open && (
        <div
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden border border-[var(--axon-line)] bg-[var(--axon-white)] shadow-2xl",
            "inset-x-3 bottom-[4.5rem] max-h-[min(72vh,560px)] rounded-2xl md:inset-auto md:bottom-6 md:right-6 md:h-[520px] md:w-[400px]",
          )}
        >
          <header className="border-b border-[var(--axon-line)] bg-[var(--axon-ink)] px-4 py-3 text-white">
            <div className="mb-2 h-1 rounded-full bg-gradient-to-r from-[var(--axon-danger)] via-[var(--axon-accent)] to-[var(--axon-signal)]" />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{t("ask.title")}</div>
                <div className="text-[11px] text-[var(--axon-signal)]/90">{t("ask.sub")}</div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-white/70 hover:bg-white/10"
                  aria-label={t("ask.collapse")}
                >
                  <Minimize2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setAnswer("");
                    setCitations([]);
                    setError("");
                    setMode("");
                  }}
                  className="rounded-lg p-1.5 text-white/70 hover:bg-white/10"
                  aria-label={t("ask.close")}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {!answer && !error && !busy && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500">{t("ask.hint")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {quick.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => ask(s)}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-200"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {busy && (
              <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                {t("ask.analyzing")}
              </div>
            )}

            {error && <p className="text-sm text-rose-600">{error}</p>}

            {answer && (
              <div className="space-y-3">
                {mode === "general" && (
                  <p className="text-[11px] text-amber-700">{t("ask.practical")}</p>
                )}
                {mode === "hybrid" && (
                  <p className="text-[11px] text-slate-500">{t("ask.officialMix")}</p>
                )}
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere]">
                  {answer}
                </div>
                {citations.length > 0 && (
                  <div className="space-y-1.5 rounded-xl bg-slate-50 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {t("ask.citations")}
                    </div>
                    {citations.slice(0, 4).map((c, i) => (
                      <a
                        key={i}
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs text-[var(--axon-blue)] hover:underline"
                      >
                        [{i + 1}] {c.title} · p.{c.page}
                      </a>
                    ))}
                  </div>
                )}
                <Link
                  href="/knowledge"
                  className="inline-block text-xs text-slate-500 hover:text-[var(--axon-blue)]"
                  onClick={() => setOpen(false)}
                >
                  {t("ask.more")}
                </Link>
              </div>
            )}
          </div>

          <footer className="border-t border-[var(--axon-line)] p-3">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                rows={2}
                className="axon-input min-h-0 flex-1 resize-none py-2 text-sm"
                placeholder={t("ask.ph")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask();
                  }
                }}
              />
              <button
                type="button"
                disabled={busy || !q.trim()}
                onClick={() => ask()}
                className="axon-btn axon-btn-primary self-end px-3"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              </button>
            </div>
          </footer>
        </div>
      )}
    </>
  );
}
