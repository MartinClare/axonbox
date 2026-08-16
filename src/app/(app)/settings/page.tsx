"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { ROLE_LABELS } from "@/lib/labels";

type SettingsData = {
  project: {
    id: string;
    name: string;
    siteCode: string;
    address: string | null;
    weather: string | null;
  } | null;
  users: Array<{ id: string; name: string; email: string; role: string }>;
  subcontractors: Array<{
    id: string;
    name: string;
    contact: string | null;
    trade?: string | null;
  }>;
  aiConfigured: boolean;
  aiModel?: string | null;
  aiProvider?: string | null;
};

type OrgInfo = {
  org: {
    name: string;
    plan: string;
    allowSubInvite: boolean;
    requireApproval: boolean;
  };
  myRole: string;
  myPermissions: string[];
  roleLabels: Record<string, string>;
};

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [form, setForm] = useState({ name: "", siteCode: "", address: "", weather: "" });
  const [msg, setMsg] = useState("");
  const [more, setMore] = useState(false);

  useEffect(() => {
    apiFetch<SettingsData>("/api/settings").then((res) => {
      if (!res.ok || !res.data) return;
      setData(res.data);
      if (res.data.project) {
        setForm({
          name: res.data.project.name,
          siteCode: res.data.project.siteCode,
          address: res.data.project.address || "",
          weather: res.data.project.weather || "",
        });
      }
    });
    apiFetch<OrgInfo>("/api/org").then((res) => {
      if (res.ok && res.data) setOrg(res.data);
    });
  }, []);

  async function save() {
    if (!data?.project) return;
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: data.project.id, ...form }),
    });
    if (res.ok) setMsg("已儲存");
  }

  if (!data) return <div className="text-sm text-slate-500">載入中…</div>;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="axon-title text-2xl font-semibold">設定</h1>
        <p className="mt-1 text-sm axon-muted">項目資料與 AI 狀態</p>
      </div>

      <section className="axon-panel space-y-3 p-5">
        <h2 className="text-sm font-semibold text-[var(--axon-ink)]">項目資訊</h2>
        <input
          className="axon-input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="項目名稱"
        />
        <input
          className="axon-input"
          value={form.siteCode}
          onChange={(e) => setForm({ ...form, siteCode: e.target.value })}
          placeholder="地盤編號"
        />
        {more && (
          <>
            <input
              className="axon-input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="地址"
            />
            <input
              className="axon-input"
              value={form.weather}
              onChange={(e) => setForm({ ...form, weather: e.target.value })}
              placeholder="天氣"
            />
          </>
        )}
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          className="text-sm text-[var(--axon-blue)]"
        >
          {more ? "收合進階欄位" : "更多（地址／天氣）"}
        </button>
        <button onClick={save} className="axon-btn axon-btn-primary w-full">
          儲存
        </button>
        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      </section>

      {org && (
        <section className="axon-panel space-y-3 p-5">
          <h2 className="text-sm font-semibold text-[var(--axon-ink)]">企業權限（可商用）</h2>
          <p className="text-sm text-slate-600">
            組織：{org.org.name} · 方案 {org.org.plan}
          </p>
          <p className="text-sm">
            我的角色：
            <span className="font-medium text-[var(--axon-ink)]">
              {ROLE_LABELS[org.myRole] || org.roleLabels[org.myRole] || org.myRole}
            </span>
          </p>
          <p className="text-xs text-slate-500">
            角色層級：企業擁有人 → 管理員 → 現場主管 → 唯讀／分判。寫入人員、組織設定需管理員以上。
          </p>
          <div className="flex flex-wrap gap-1">
            {org.myPermissions.slice(0, 8).map((p) => (
              <span key={p} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                {p}
              </span>
            ))}
            {org.myPermissions.length > 8 && (
              <span className="text-[10px] text-slate-400">+{org.myPermissions.length - 8}</span>
            )}
          </div>
          <Link href="/directory" className="text-sm text-[var(--axon-blue)]">
            管理成員角色 →
          </Link>
        </section>
      )}

      <section className="axon-panel space-y-2 p-5">
        <h2 className="text-sm font-semibold text-[var(--axon-ink)]">AI 狀態</h2>
        <p className="text-sm">
          <span className={data.aiConfigured ? "text-emerald-600" : "text-amber-600"}>
            {data.aiConfigured
              ? `已接入（${data.aiProvider || "api"} · ${data.aiModel || "model"}）`
              : "未設定（Mock）"}
          </span>
        </p>
        <p className="text-xs text-slate-400">
          於 .env 設定 OPENROUTER_API_KEY 與 AI_MODEL 後重啟服務。
        </p>
      </section>

      <section className="axon-panel p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--axon-ink)]">人員與公司</h2>
          <Link
            href="/directory"
            className="inline-flex items-center gap-1 text-sm text-[var(--axon-blue)]"
          >
            前往管理
            <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="text-2xl font-semibold text-[var(--axon-ink)]">{data.users.length}</div>
            <div className="text-xs text-slate-500">人員帳號</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="text-2xl font-semibold text-[var(--axon-ink)]">
              {data.subcontractors.length}
            </div>
            <div className="text-xs text-slate-500">分判公司</div>
          </div>
        </div>
      </section>
    </div>
  );
}
