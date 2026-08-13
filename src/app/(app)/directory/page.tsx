"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { ROLE_LABELS, TRADE_OPTIONS, cn } from "@/lib/labels";
import { apiFetch, asArray } from "@/lib/api-client";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  title: string | null;
  company: string | null;
  notes: string | null;
  _count?: { assignedCases: number; assignedTasks: number };
};

type SubRow = {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  trade: string | null;
  address: string | null;
  licenseNo: string | null;
  notes: string | null;
  userId: string | null;
  user?: { id: string; name: string; email: string } | null;
  _count?: { cases: number };
};

type UserForm = {
  name: string;
  email: string;
  role: string;
  phone: string;
  title: string;
  company: string;
  notes: string;
  password: string;
};

type SubForm = {
  name: string;
  contact: string;
  phone: string;
  email: string;
  trade: string;
  address: string;
  licenseNo: string;
  notes: string;
  userId: string;
};

const emptyUser = (): UserForm => ({
  name: "",
  email: "",
  role: "SUPERVISOR",
  phone: "",
  title: "",
  company: "",
  notes: "",
  password: "demo1234",
});

const emptySub = (): SubForm => ({
  name: "",
  contact: "",
  phone: "",
  email: "",
  trade: "",
  address: "",
  licenseNo: "",
  notes: "",
  userId: "",
});

export default function DirectoryPage() {
  const [tab, setTab] = useState<"people" | "companies">("people");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [userOpen, setUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(emptyUser());

  const [subOpen, setSubOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<SubRow | null>(null);
  const [subForm, setSubForm] = useState<SubForm>(emptySub());

  const load = useCallback(async () => {
    const [u, s] = await Promise.all([
      apiFetch<UserRow[]>("/api/users"),
      apiFetch<SubRow[]>("/api/subcontractors"),
    ]);
    setUsers(u.ok ? asArray<UserRow>(u.data) : []);
    setSubs(s.ok ? asArray<SubRow>(s.data) : []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        (u.company || "").toLowerCase().includes(s) ||
        (u.title || "").toLowerCase().includes(s),
    );
  }, [users, q]);

  const filteredSubs = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return subs;
    return subs.filter(
      (x) =>
        x.name.toLowerCase().includes(s) ||
        (x.contact || "").toLowerCase().includes(s) ||
        (x.trade || "").toLowerCase().includes(s) ||
        (x.email || "").toLowerCase().includes(s),
    );
  }, [subs, q]);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(""), 2500);
  }

  function openCreateUser() {
    setEditingUser(null);
    setUserForm(emptyUser());
    setUserOpen(true);
  }

  function openEditUser(u: UserRow) {
    setEditingUser(u);
    setUserForm({
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone || "",
      title: u.title || "",
      company: u.company || "",
      notes: u.notes || "",
      password: "",
    });
    setUserOpen(true);
  }

  function openCreateSub() {
    setEditingSub(null);
    setSubForm(emptySub());
    setSubOpen(true);
  }

  function openEditSub(s: SubRow) {
    setEditingSub(s);
    setSubForm({
      name: s.name,
      contact: s.contact || "",
      phone: s.phone || "",
      email: s.email || "",
      trade: s.trade || "",
      address: s.address || "",
      licenseNo: s.licenseNo || "",
      notes: s.notes || "",
      userId: s.userId || "",
    });
    setSubOpen(true);
  }

  async function saveUser() {
    setBusy(true);
    const payload = {
      ...userForm,
      password: userForm.password || undefined,
    };
    const res = editingUser
      ? await fetch(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    setBusy(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      flash(err.error === "email already exists" ? "電郵已存在" : "保存失敗");
      return;
    }
    setUserOpen(false);
    flash(editingUser ? "人員已更新" : "人員已新增");
    await load();
  }

  async function deleteUser(id: string) {
    if (!confirm("確定刪除此人員？相關事件指派會清空。")) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      flash("無法刪除（可能是當前登入帳號）");
      return;
    }
    flash("人員已刪除");
    await load();
  }

  async function saveSub() {
    setBusy(true);
    const payload = {
      ...subForm,
      userId: subForm.userId || null,
    };
    const res = editingSub
      ? await fetch(`/api/subcontractors/${editingSub.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/subcontractors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
    setBusy(false);
    if (!res.ok) {
      flash("保存失敗");
      return;
    }
    setSubOpen(false);
    flash(editingSub ? "公司已更新" : "公司已新增");
    await load();
  }

  async function deleteSub(id: string) {
    if (!confirm("確定刪除此公司？相關事件分判指派會清空。")) return;
    await fetch(`/api/subcontractors/${id}`, { method: "DELETE" });
    flash("公司已刪除");
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Directory
          </p>
          <h1 className="axon-title mt-1 text-2xl font-semibold">人員與公司</h1>
          <p className="mt-1 text-sm axon-muted">
            維護現場人員、分判公司與聯絡資料，供事件指派使用
          </p>
        </div>
        <div className="flex items-center gap-2">
          {msg && (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
              {msg}
            </span>
          )}
          <button
            onClick={tab === "people" ? openCreateUser : openCreateSub}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--axon-ink)] px-4 py-2.5 text-sm text-white transition hover:bg-[var(--axon-navy)]"
          >
            <Plus size={16} />
            {tab === "people" ? "新增人員" : "新增公司"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-[var(--axon-line)] bg-white p-1">
          <button
            onClick={() => setTab("people")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm transition",
              tab === "people"
                ? "bg-[var(--axon-ink)] text-white"
                : "text-slate-600 hover:bg-slate-50",
            )}
          >
            <Users size={15} />
            人員
            <span className="text-xs opacity-70">{users.length}</span>
          </button>
          <button
            onClick={() => setTab("companies")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm transition",
              tab === "companies"
                ? "bg-[var(--axon-ink)] text-white"
                : "text-slate-600 hover:bg-slate-50",
            )}
          >
            <Building2 size={15} />
            公司
            <span className="text-xs opacity-70">{subs.length}</span>
          </button>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tab === "people" ? "搜尋姓名、電郵、職稱…" : "搜尋公司、聯絡人、工種…"}
          className="min-w-[220px] flex-1 rounded-xl border border-[var(--axon-line)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
        />
      </div>

      {tab === "people" ? (
        <div className="axon-panel overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--axon-line)] bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">姓名</th>
                <th className="px-4 py-3 font-medium">角色</th>
                <th className="px-4 py-3 font-medium">職稱 / 公司</th>
                <th className="px-4 py-3 font-medium">聯絡</th>
                <th className="px-4 py-3 font-medium">事件</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--axon-ink)]">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div>{u.title || "—"}</div>
                    <div className="text-xs text-slate-400">{u.company || ""}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.phone || "—"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {u._count?.assignedCases ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEditUser(u)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[var(--axon-ink)]"
                        title="編輯"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteUser(u.id)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="刪除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    尚無人員，點右上角新增
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredSubs.map((s) => (
            <article key={s.id} className="axon-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-[var(--axon-ink)]">
                    {s.name}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    {s.trade && (
                      <span className="rounded-md bg-[var(--axon-sand)] px-2 py-0.5 text-[var(--axon-blue)]">
                        {s.trade}
                      </span>
                    )}
                    <span className="text-slate-400">
                      關聯事件 {s._count?.cases ?? 0}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditSub(s)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[var(--axon-ink)]"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => deleteSub(s.id)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div>
                  <dt className="text-[11px] text-slate-400">聯絡人</dt>
                  <dd>{s.contact || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-400">電話</dt>
                  <dd>{s.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-400">電郵</dt>
                  <dd className="truncate">{s.email || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-400">牌照</dt>
                  <dd>{s.licenseNo || "—"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[11px] text-slate-400">地址</dt>
                  <dd>{s.address || "—"}</dd>
                </div>
                {s.user && (
                  <div className="col-span-2">
                    <dt className="text-[11px] text-slate-400">關聯登入帳號</dt>
                    <dd>
                      {s.user.name}{" "}
                      <span className="text-slate-400">({s.user.email})</span>
                    </dd>
                  </div>
                )}
                {s.notes && (
                  <div className="col-span-2">
                    <dt className="text-[11px] text-slate-400">備註</dt>
                    <dd className="text-slate-600">{s.notes}</dd>
                  </div>
                )}
              </dl>
            </article>
          ))}
          {filteredSubs.length === 0 && (
            <div className="axon-panel col-span-full px-4 py-10 text-center text-slate-400">
              尚無公司，點右上角新增
            </div>
          )}
        </div>
      )}

      {userOpen && (
        <Modal
          title={editingUser ? "編輯人員" : "新增人員"}
          onClose={() => setUserOpen(false)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="姓名 *">
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                placeholder="陳生"
              />
            </Field>
            <Field label="電郵 *">
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="name@company.com"
              />
            </Field>
            <Field label="角色">
              <select
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
              >
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="電話">
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                placeholder="9123 4567"
              />
            </Field>
            <Field label="職稱">
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={userForm.title}
                onChange={(e) => setUserForm({ ...userForm, title: e.target.value })}
                placeholder="現場主管"
              />
            </Field>
            <Field label="所屬公司">
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={userForm.company}
                onChange={(e) => setUserForm({ ...userForm, company: e.target.value })}
                placeholder="總承建商 / 顧問公司"
              />
            </Field>
            <Field label={editingUser ? "重設密碼（可留空）" : "初始密碼"}>
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                type="text"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                placeholder="demo1234"
              />
            </Field>
            <Field label="備註" className="sm:col-span-2">
              <textarea
                className="min-h-[72px] w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={userForm.notes}
                onChange={(e) => setUserForm({ ...userForm, notes: e.target.value })}
                placeholder="班次、負責區域等"
              />
            </Field>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setUserOpen(false)}
              className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              取消
            </button>
            <button
              disabled={busy || !userForm.name || !userForm.email}
              onClick={saveUser}
              className="rounded-xl bg-[var(--axon-ink)] px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              保存
            </button>
          </div>
        </Modal>
      )}

      {subOpen && (
        <Modal
          title={editingSub ? "編輯公司" : "新增公司"}
          onClose={() => setSubOpen(false)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="公司名稱 *" className="sm:col-span-2">
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={subForm.name}
                onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
                placeholder="永盛鋼鐵工程"
              />
            </Field>
            <Field label="工種">
              <select
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={subForm.trade}
                onChange={(e) => setSubForm({ ...subForm, trade: e.target.value })}
              >
                <option value="">選擇工種</option>
                {TRADE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="聯絡人">
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={subForm.contact}
                onChange={(e) => setSubForm({ ...subForm, contact: e.target.value })}
                placeholder="黃工"
              />
            </Field>
            <Field label="電話">
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={subForm.phone}
                onChange={(e) => setSubForm({ ...subForm, phone: e.target.value })}
                placeholder="2123 4567"
              />
            </Field>
            <Field label="電郵">
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                type="email"
                value={subForm.email}
                onChange={(e) => setSubForm({ ...subForm, email: e.target.value })}
                placeholder="ops@vendor.com"
              />
            </Field>
            <Field label="牌照編號">
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={subForm.licenseNo}
                onChange={(e) => setSubForm({ ...subForm, licenseNo: e.target.value })}
                placeholder="CIC / 註冊編號"
              />
            </Field>
            <Field label="關聯登入帳號">
              <select
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={subForm.userId}
                onChange={(e) => setSubForm({ ...subForm, userId: e.target.value })}
              >
                <option value="">不關聯</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="地址" className="sm:col-span-2">
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={subForm.address}
                onChange={(e) => setSubForm({ ...subForm, address: e.target.value })}
                placeholder="公司地址"
              />
            </Field>
            <Field label="備註" className="sm:col-span-2">
              <textarea
                className="min-h-[72px] w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={subForm.notes}
                onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })}
                placeholder="合約範圍、進場須知等"
              />
            </Field>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setSubOpen(false)}
              className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              取消
            </button>
            <button
              disabled={busy || !subForm.name}
              onClick={saveSub}
              className="rounded-xl bg-[var(--axon-ink)] px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              保存
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--axon-ink)]">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
