"use client";

import { useState } from "react";
import { BookOpen, Loader2, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useI18n } from "@/components/I18nProvider";

type Citation = {
  title: string;
  source: string;
  page: string | number;
  section?: string;
  url: string;
};

const SUGGESTIONS_ZH = [
  "什麼是 XPMS？如何登記成為用戶？",
  "開工前 Advance Notification 要提前多久提交？",
  "工地出入口與行人通道有什麼安全要點？",
  "混凝土澆置前應檢查哪些項目？",
  "短期工程與標準／非標準工程有何分別？",
];

const SUGGESTIONS_EN = [
  "What is XPMS and how do I register?",
  "How far in advance must Advance Notification be submitted?",
  "What are the safety points for site access and pedestrian routes?",
  "What should be checked before concreting?",
  "How do short-term works differ from standard / non-standard works?",
];

export default function KnowledgePage() {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [busy, setBusy] = useState(false);
  const [mock, setMock] = useState(false);

  const suggestions = locale === "en" ? SUGGESTIONS_EN : SUGGESTIONS_ZH;

  async function ask(question?: string) {
    const text = (question || q).trim();
    if (!text) return;
    setQ(text);
    setBusy(true);
    setAnswer("");
    setCitations([]);
    const res = await apiFetch<{
      answer: string;
      citations: Citation[];
      mock?: boolean;
    }>("/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text }),
    });
    setBusy(false);
    if (!res.ok) {
      setAnswer(res.error);
      return;
    }
    setAnswer(res.data?.answer || "");
    setCitations(res.data?.citations || []);
    setMock(Boolean(res.data?.mock));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="axon-title text-2xl font-semibold">{t("knowledge.title")}</h1>
        <p className="mt-1 text-sm axon-muted">{t("knowledge.subtitle")}</p>
        <p className="mt-1 text-xs text-slate-400">{t("knowledge.official")}</p>
      </div>

      <section className="axon-panel space-y-3 p-5">
        <textarea
          className="axon-input min-h-[100px]"
          placeholder={t("knowledge.ph")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          disabled={busy || !q.trim()}
          onClick={() => ask()}
          className="axon-btn axon-btn-primary w-full"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {t("knowledge.aiAnswer")}
        </button>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200"
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {(answer || citations.length > 0) && (
        <section className="axon-panel space-y-4 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen size={15} />
            {t("knowledge.answer")}
            {mock && (
              <span className="text-xs font-normal text-amber-600">{t("knowledge.mock")}</span>
            )}
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere]">
            {answer}
          </div>
          {citations.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t("knowledge.sources")}
              </h3>
              <ul className="space-y-2">
                {citations.map((c, i) => (
                  <li key={i} className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    <div className="font-medium text-[var(--axon-ink)]">
                      [{i + 1}] {c.title}
                    </div>
                    <div>
                      {c.source} · p.{c.page}
                      {c.section ? ` · ${c.section}` : ""}
                    </div>
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--axon-blue)] hover:underline"
                    >
                      {t("knowledge.openSource")}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
