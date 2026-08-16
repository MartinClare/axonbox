"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Timeline } from "@/components/Timeline";
import {
  CATEGORY_LABELS,
  CASE_STATUS_LABELS,
  SEVERITY_LABELS,
  STATUS_COLORS,
  CATEGORY_COLORS,
  cn,
  daysRemaining,
  formatDate,
} from "@/lib/labels";
import { mediaUrl } from "@/lib/media";
import { apiFetch, asArray } from "@/lib/api-client";
import { hasAfterEvidence, parseEvidenceTags, tagsIncludeAfter } from "@/lib/case-closeout";

type CaseDetail = {
  id: string;
  caseNo: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  location: string;
  status: string;
  recommendation: string | null;
  dueAt: string | null;
  discoveredAt: string;
  closedAt?: string | null;
  assigneeId?: string | null;
  subcontractorId?: string | null;
  assignee?: { id: string; name: string } | null;
  subcontractor?: { id: string; name: string } | null;
  events: Array<{
    id: string;
    type: string;
    note: string | null;
    createdAt: string;
    actor?: { name: string } | null;
  }>;
  evidence: Array<{
    id: string;
    title: string;
    type: string;
    mime?: string | null;
    filePath: string | null;
    chatText: string | null;
    tagsJson?: string | null;
    createdAt?: string;
  }>;
  tasks: Array<{ id: string; title: string; status: string; instructions: string | null }>;
  project: { name: string; siteCode: string };
};

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<CaseDetail | null>(null);
  const [subs, setSubs] = useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [tab, setTab] = useState<"details" | "progress" | "files" | "logs">("details");
  const [assign, setAssign] = useState({
    subcontractorId: "",
    assigneeId: "",
    dueAt: "",
    instructions: "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [waiveOpen, setWaiveOpen] = useState(false);
  const [waiveNote, setWaiveNote] = useState("");

  async function load() {
    const [cRes, sRes] = await Promise.all([
      apiFetch<CaseDetail>(`/api/cases/${id}`),
      apiFetch<{ subcontractors?: Array<{ id: string; name: string }>; users?: Array<{ id: string; name: string }> }>(
        "/api/settings",
      ),
    ]);
    if (!cRes.ok || !cRes.data || typeof cRes.data !== "object" || !("id" in cRes.data)) {
      setItem(null);
      setMsg(cRes.ok ? "找不到事件" : cRes.error);
      return;
    }
    const c = cRes.data;
    setItem(c);
    setSubs(sRes.ok ? asArray(sRes.data?.subcontractors) : []);
    setUsers(sRes.ok ? asArray(sRes.data?.users) : []);
    setAssign((a) => ({
      ...a,
      subcontractorId: c.subcontractorId || c.subcontractor?.id || "",
      assigneeId: c.assigneeId || c.assignee?.id || "",
      instructions: c.recommendation || "",
      dueAt: c.dueAt ? c.dueAt.slice(0, 10) : "",
    }));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const afterReady = useMemo(() => {
    if (!item) return false;
    return hasAfterEvidence(
      item.evidence.map((e) => ({
        id: e.id,
        createdAt: e.createdAt || item.discoveredAt,
        tagsJson: e.tagsJson,
      })),
      item.events,
    );
  }, [item]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/cases/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(data.message || data.error || "操作失敗");
      return false;
    }
    setMsg("已更新");
    await load();
    router.refresh();
    return true;
  }

  async function tryClose() {
    if (!item) return;
    if (!afterReady) {
      setWaiveOpen(true);
      setMsg("尚未有整改後證據：請先標記附件，或填寫原因後無圖關閉");
      return;
    }
    await patch({
      status: "CLOSED",
      eventType: "CLOSE",
      eventNote: "核驗通過，事件關閉",
    });
  }

  async function confirmWaiveClose() {
    const note = waiveNote.trim();
    if (!note) {
      setMsg("請填寫無圖關閉原因");
      return;
    }
    const ok = await patch({
      status: "CLOSED",
      waiveCloseEvidence: true,
      eventNote: note,
    });
    if (ok) {
      setWaiveOpen(false);
      setWaiveNote("");
    }
  }

  async function downloadArchive() {
    const res = await fetch(`/api/cases/${id}/archive`);
    const data = await res.json();
    if (data.filePath) window.open(data.filePath, "_blank");
  }

  async function downloadPack() {
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/cases/${id}/pack`);
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "結案摘要產生失敗");
      return;
    }
    if (data.filePath) window.open(data.filePath, "_blank");
    setMsg("已產生結案摘要 PDF");
  }

  async function markAfter(evidenceId: string) {
    setBusy(true);
    const res = await fetch(`/api/evidence/${evidenceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAfter: true }),
    });
    setBusy(false);
    if (!res.ok) {
      setMsg("標記失敗");
      return;
    }
    setMsg("已標記為整改後");
    await load();
  }

  async function deleteCase() {
    if (!item) return;
    if (
      !window.confirm(
        `確定刪除事件 ${item.caseNo}？\n「${item.title}」\n相關任務與日誌會一併刪除；附件會保留但取消關聯。`,
      )
    ) {
      return;
    }
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/cases/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "刪除失敗");
      return;
    }
    router.push("/cases");
    router.refresh();
  }

  if (!item) {
    return (
      <div className="space-y-3 py-10 text-center">
        <p className="text-sm text-slate-500">{msg || "載入中…"}</p>
        {msg && (
          <Link href="/cases" className="axon-btn axon-btn-ghost inline-flex">
            返回事件列表
          </Link>
        )}
      </div>
    );
  }

  const remain = daysRemaining(item.dueAt);
  const openDays = Math.max(
    0,
    Math.floor(
      ((item.closedAt ? new Date(item.closedAt).getTime() : Date.now()) -
        new Date(item.discoveredAt).getTime()) /
        86400000,
    ),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs text-slate-400">{item.caseNo}</div>
          <h1 className="text-2xl font-semibold text-[var(--axon-navy)]">{item.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={cn("rounded px-2 py-0.5", CATEGORY_COLORS[item.category])}>
              {CATEGORY_LABELS[item.category]}
            </span>
            <span className={cn("rounded-full px-2 py-0.5", STATUS_COLORS[item.status])}>
              {CASE_STATUS_LABELS[item.status]}
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
              嚴重度：{SEVERITY_LABELS[item.severity]}
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
              已開 {openDays} 天
            </span>
            {remain !== null && item.status !== "CLOSED" && (
              <span
                className={cn(
                  "rounded px-2 py-0.5",
                  remain < 0 ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700",
                )}
              >
                {remain < 0 ? `逾期 ${Math.abs(remain)} 天` : `剩餘 ${remain} 天`}
              </span>
            )}
            {afterReady ? (
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">已有整改後證據</span>
            ) : (
              item.status !== "CLOSED" && (
                <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800">尚無整改後證據</span>
              )
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={downloadPack}
            disabled={busy}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            結案摘要
          </button>
          <button
            onClick={downloadArchive}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50"
          >
            下載全部證據
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={deleteCase}
            className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 hover:bg-rose-100 disabled:opacity-50"
          >
            刪除事件
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {(
          [
            ["details", "詳情"],
            ["progress", "進度"],
            ["files", "附件"],
            ["logs", "日誌"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm",
              tab === k
                ? "border-[var(--axon-blue)] text-[var(--axon-blue)]"
                : "border-transparent text-slate-500",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold">事件資訊</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">位置</dt>
                <dd>{item.location}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">發現時間</dt>
                <dd>{formatDate(item.discoveredAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">負責人</dt>
                <dd>{item.assignee?.name || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">分判</dt>
                <dd>{item.subcontractor?.name || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">項目</dt>
                <dd>{item.project.name}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm leading-relaxed text-slate-700">{item.description}</p>
            {item.recommendation && (
              <p className="mt-3 rounded-lg bg-sky-50 p-3 text-sm text-sky-900">
                建議：{item.recommendation}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold">指派分判</h2>
            <div className="space-y-3">
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={assign.subcontractorId}
                onChange={(e) => setAssign({ ...assign, subcontractorId: e.target.value })}
              >
                <option value="">選擇分判商</option>
                {subs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={assign.assigneeId}
                onChange={(e) => setAssign({ ...assign, assigneeId: e.target.value })}
              >
                <option value="">選擇負責人</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={assign.dueAt}
                onChange={(e) => setAssign({ ...assign, dueAt: e.target.value })}
              />
              <textarea
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={3}
                placeholder="整改指示"
                value={assign.instructions}
                onChange={(e) => setAssign({ ...assign, instructions: e.target.value })}
              />
              <button
                disabled={busy}
                onClick={() =>
                  patch({
                    status: "ASSIGNED",
                    eventType: "ASSIGN",
                    eventNote: `已發送指示給分判`,
                    subcontractorId: assign.subcontractorId || null,
                    assigneeId: assign.assigneeId || null,
                    dueAt: assign.dueAt || null,
                    instructions: assign.instructions,
                  })
                }
                className="w-full rounded-lg bg-[var(--axon-blue)] py-2 text-sm text-white disabled:opacity-50"
              >
                發送指示 / 指派
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <h2 className="mb-3 text-sm font-semibold">快捷操作</h2>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={busy}
                onClick={() =>
                  patch({ status: "IN_PROGRESS", eventType: "PROGRESS", eventNote: "開始整改" })
                }
                className="rounded-lg border px-3 py-2 text-sm"
              >
                標記進行中
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  patch({
                    status: "PENDING_REVIEW",
                    eventType: "REVIEW",
                    eventNote: "提交核驗",
                  })
                }
                className="rounded-lg border px-3 py-2 text-sm"
              >
                提交核驗
              </button>
              <button
                disabled={busy || item.status === "CLOSED"}
                onClick={tryClose}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                核驗通過並關閉
              </button>
              <button
                disabled={busy}
                onClick={downloadPack}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
              >
                下載結案摘要
              </button>
            </div>
            {waiveOpen && item.status !== "CLOSED" && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-900">
                  尚無整改後證據。請到「附件」標記整改後照片，或填寫原因後無圖關閉。
                </p>
                <textarea
                  className="mt-2 w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
                  rows={2}
                  placeholder="無圖關閉原因（必填）"
                  value={waiveNote}
                  onChange={(e) => setWaiveNote(e.target.value)}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={confirmWaiveClose}
                    className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs text-white"
                  >
                    無圖關閉
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWaiveOpen(false);
                      setTab("files");
                    }}
                    className="rounded-lg border px-3 py-1.5 text-xs"
                  >
                    去標記附件
                  </button>
                  <button
                    type="button"
                    onClick={() => setWaiveOpen(false)}
                    className="rounded-lg px-3 py-1.5 text-xs text-slate-500"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
            {msg && (
              <p className={cn("mt-2 text-sm", msg.includes("失敗") || msg.includes("請") ? "text-rose-600" : "text-emerald-600")}>
                {msg}
              </p>
            )}
          </section>
        </div>
      )}

      {tab === "progress" && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <Timeline events={item.events} />
        </section>
      )}

      {tab === "files" && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {item.evidence.map((e) => {
            const href = mediaUrl(e.filePath);
            const image = Boolean(e.mime?.startsWith("image/") && href);
            const isAfter = tagsIncludeAfter(e.tagsJson);
            const tags = parseEvidenceTags(e.tagsJson);
            return (
              <div key={e.id} className="rounded-xl border border-slate-200 bg-white p-3">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={href!} alt="" className="mb-2 h-36 w-full rounded-lg object-cover bg-slate-100" />
                ) : (
                  <div className="mb-2 flex h-36 flex-col items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 text-center text-xs text-slate-500">
                    <span>{e.type === "CHAT" ? "郵件正文" : e.mime || e.type}</span>
                    {href && e.type !== "CHAT" && (
                      <a href={href} target="_blank" rel="noreferrer" className="text-[var(--axon-blue)]">
                        開啟附件
                      </a>
                    )}
                  </div>
                )}
                <div className="text-sm font-medium">{e.title}</div>
                {tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                {e.chatText && <p className="mt-1 line-clamp-3 text-xs text-slate-500">{e.chatText}</p>}
                {isAfter ? (
                  <p className="mt-2 text-xs font-medium text-emerald-700">已標記整改後</p>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => markAfter(e.id)}
                    className="mt-2 text-xs font-medium text-[var(--axon-blue)] hover:underline"
                  >
                    標記為整改後
                  </button>
                )}
              </div>
            );
          })}
          {item.evidence.length === 0 && <p className="text-sm text-slate-400">尚無附件</p>}
        </section>
      )}

      {tab === "logs" && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold">任務</h2>
          <ul className="mb-6 space-y-2">
            {item.tasks.map((t) => (
              <li key={t.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                {t.title}
                <span className="ml-2 text-xs text-slate-400">{t.status}</span>
              </li>
            ))}
          </ul>
          <Timeline events={item.events} />
        </section>
      )}
    </div>
  );
}
