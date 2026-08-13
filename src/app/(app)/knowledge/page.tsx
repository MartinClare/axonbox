"use client";

import { useState } from "react";
import { BookOpen, Loader2, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api-client";

type Citation = {
  title: string;
  source: string;
  page: string | number;
  section?: string;
  url: string;
};

const SUGGESTIONS = [
  "什麼是 XPMS？如何登記成為用戶？",
  "開工前 Advance Notification 要提前多久提交？",
  "工地出入口與行人通道有什麼安全要點？",
  "混凝土澆置前應檢查哪些項目？",
  "短期工程與標準／非標準工程有何分別？",
];

export default function KnowledgePage() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [busy, setBusy] = useState(false);
  const [mock, setMock] = useState(false);

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
        <h1 className="axon-title text-2xl font-semibold">工程提問</h1>
        <p className="mt-1 text-sm axon-muted">
          HyD／XPMS 官方問題會附來源頁碼；一般工地安全、品質、進度等也可直接問 AI。
          右下角「問工程」可快速查詢。
        </p>
        <p className="mt-1 text-xs text-slate-400">
          官方：xpms.hyd.gov.hk · www.hyd.gov.hk
        </p>
      </div>

      <section className="axon-panel space-y-3 p-5">
        <textarea
          className="axon-input min-h-[100px]"
          placeholder="例如：XPMS 如何登記？或：圍板固定要注意什麼？"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          disabled={busy || !q.trim()}
          onClick={() => ask()}
          className="axon-btn axon-btn-primary w-full"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          AI 工程回答
        </button>
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
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
            回答
            {mock && <span className="text-xs font-normal text-amber-600">（知識庫直出／Mock）</span>}
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere]">
            {answer}
          </div>
          {citations.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                引用來源（頁碼／章節）
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
                      開啟原文
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
