"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  Copy,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { TRADE_OPTIONS, cn } from "@/lib/labels";
import { apiFetch, asArray } from "@/lib/api-client";
import { useI18n } from "@/components/I18nProvider";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  title: string | null;
  company: string | null;
  notes: string | null;
  inboundKey?: string | null;
  inboundAddress?: string | null;
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
  inboundKey: string;
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
  inboundKey: "",
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

/** Canonical DB values (zh) → i18n keys for dropdown labels. */
const TRADE_KEYS: Record<string, string> = {
  安全防護: "trade.safety",
  鋼筋: "trade.rebar",
  模板: "trade.formwork",
  混凝土: "trade.concrete",
  電氣: "trade.electrical",
  水電: "trade.me",
  環保清潔: "trade.enviro",
  團隊工程: "trade.civil",
  其他: "trade.other",
};

export default function DirectoryPage() {
  const { t, roleLabels } = useI18n();
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
        (u.title || "").toLowerCase().includes(s) ||
        (u.inboundKey || "").toLowerCase().includes(s),
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

  function tradeLabel(value: string | null | undefined) {
    if (!value) return "";
    const key = TRADE_KEYS[value];
    return key ? t(key) : value;
  }

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
      inboundKey: u.inboundKey || "",
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
      flash(err.error === "email already exists" ? t("dir.emailExists") : t("dir.saveFail"));
      return;
    }
    setUserOpen(false);
    flash(editingUser ? t("dir.personUpdated") : t("dir.personAdded"));
    await load();
  }

  async function deleteUser(id: string) {
    if (!confirm(t("dir.personDelConfirm"))) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      flash(t("dir.personDelFail"));
      return;
    }
    flash(t("dir.personDeleted"));
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
      flash(t("dir.saveFail"));
      return;
    }
    setSubOpen(false);
    flash(editingSub ? t("dir.coUpdated") : t("dir.coAdded"));
    await load();
  }

  async function deleteSub(id: string) {
    if (!confirm(t("dir.coDelConfirm"))) return;
    await fetch(`/api/subcontractors/${id}`, { method: "DELETE" });
    flash(t("dir.coDeleted"));
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Directory
          </p>
          <h1 className="axon-title mt-1 text-2xl font-semibold">{t("dir.title")}</h1>
          <p className="mt-1 text-sm axon-muted">{t("dir.subtitle")}</p>
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
            {tab === "people" ? t("dir.addPerson") : t("dir.addCompany")}
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
            {t("dir.tabPeople")}
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
            {t("common.company")}
            <span className="text-xs opacity-70">{subs.length}</span>
          </button>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tab === "people" ? t("dir.searchPeople") : t("dir.searchCos")}
          className="min-w-[220px] flex-1 rounded-xl border border-[var(--axon-line)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
        />
      </div>

      {tab === "people" ? (
        <div className="axon-panel overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[var(--axon-line)] bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t("dir.col.name")}</th>
                <th className="px-4 py-3 font-medium">{t("dir.col.role")}</th>
                <th className="px-4 py-3 font-medium">{t("dir.col.titleCo")}</th>
                <th className="px-4 py-3 font-medium">{t("dir.col.forward")}</th>
                <th className="px-4 py-3 font-medium">{t("dir.col.contact")}</th>
                <th className="px-4 py-3 font-medium">{t("dir.col.cases")}</th>
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
                      {roleLabels[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div>{u.title || t("common.none")}</div>
                    <div className="text-xs text-slate-400">{u.company || ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    {u.inboundAddress ? (
                      <button
                        type="button"
                        className="inline-flex max-w-[220px] items-center gap-1 text-left text-xs text-[var(--axon-blue)]"
                        onClick={async () => {
                          await navigator.clipboard.writeText(u.inboundAddress || "");
                          flash(t("dir.copiedForward"));
                        }}
                        title={t("dir.copyTo")}
                      >
                        <Copy size={12} />
                        <span className="truncate">{u.inboundAddress}</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">{t("common.none")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.phone || t("common.none")}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {u._count?.assignedCases ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEditUser(u)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[var(--axon-ink)]"
                        title={t("common.edit")}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => deleteUser(u.id)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title={t("common.delete")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    {t("dir.emptyPeople")}
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
                        {tradeLabel(s.trade)}
                      </span>
                    )}
                    <span className="text-slate-400">
                      {t("dir.linkedCases", { n: s._count?.cases ?? 0 })}
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
                  <dt className="text-[11px] text-slate-400">{t("dir.contact")}</dt>
                  <dd>{s.contact || t("common.none")}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-400">{t("common.phone")}</dt>
                  <dd>{s.phone || t("common.none")}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-400">{t("common.email")}</dt>
                  <dd className="truncate">{s.email || t("common.none")}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-400">{t("dir.license")}</dt>
                  <dd>{s.licenseNo || t("common.none")}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[11px] text-slate-400">{t("common.address")}</dt>
                  <dd>{s.address || t("common.none")}</dd>
                </div>
                {s.user && (
                  <div className="col-span-2">
                    <dt className="text-[11px] text-slate-400">{t("dir.linkedUser")}</dt>
                    <dd>
                      {s.user.name}{" "}
                      <span className="text-slate-400">({s.user.email})</span>
                    </dd>
                  </div>
                )}
                {s.notes && (
                  <div className="col-span-2">
                    <dt className="text-[11px] text-slate-400">{t("common.notes")}</dt>
                    <dd className="text-slate-600">{s.notes}</dd>
                  </div>
                )}
              </dl>
            </article>
          ))}
          {filteredSubs.length === 0 && (
            <div className="axon-panel col-span-full px-4 py-10 text-center text-slate-400">
              {t("dir.emptyCompanies")}
            </div>
          )}
        </div>
      )}

      {userOpen && (
        <Modal
          title={editingUser ? t("dir.editPerson") : t("dir.addPerson")}
          onClose={() => setUserOpen(false)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("dir.nameReq")}>
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              />
            </Field>
            <Field label={t("dir.emailReq")}>
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="name@company.com"
              />
            </Field>
            <Field label={t("common.role")}>
              <select
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
              >
                {Object.entries(roleLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("common.phone")}>
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                placeholder="9123 4567"
              />
            </Field>
            <Field label={t("dir.jobTitle")}>
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={userForm.title}
                onChange={(e) => setUserForm({ ...userForm, title: e.target.value })}
              />
            </Field>
            <Field label={t("dir.orgCo")}>
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={userForm.company}
                onChange={(e) => setUserForm({ ...userForm, company: e.target.value })}
                placeholder={t("dir.orgPh")}
              />
            </Field>
            {editingUser?.inboundAddress && (
              <Field label={t("dir.forwardCode")} className="sm:col-span-2">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-xl bg-slate-50 px-3 py-2 text-xs">
                    {editingUser.inboundAddress}
                  </code>
                  <button
                    type="button"
                    className="rounded-xl px-3 py-2 text-xs text-[var(--axon-blue)] hover:bg-slate-100"
                    onClick={async () => {
                      const res = await fetch(`/api/users/${editingUser.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ regenerateInboundKey: true }),
                      });
                      if (!res.ok) {
                        flash(t("dir.resetFail"));
                        return;
                      }
                      flash(t("dir.resetOk"));
                      await load();
                      const next = await res.json();
                      setUserForm({ ...userForm, inboundKey: next.inboundKey || "" });
                    }}
                  >
                    {t("dir.resetCode")}
                  </button>
                </div>
              </Field>
            )}
            <Field label={editingUser ? t("dir.resetPassword") : t("dir.initPassword")}>
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                type="text"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                placeholder="demo1234"
              />
            </Field>
            <Field label={t("common.notes")} className="sm:col-span-2">
              <textarea
                className="min-h-[72px] w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={userForm.notes}
                onChange={(e) => setUserForm({ ...userForm, notes: e.target.value })}
                placeholder={t("dir.notesPh")}
              />
            </Field>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setUserOpen(false)}
              className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              {t("common.cancel")}
            </button>
            <button
              disabled={busy || !userForm.name || !userForm.email}
              onClick={saveUser}
              className="rounded-xl bg-[var(--axon-ink)] px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              {t("common.save")}
            </button>
          </div>
        </Modal>
      )}

      {subOpen && (
        <Modal
          title={editingSub ? t("dir.editCompany") : t("dir.addCompany")}
          onClose={() => setSubOpen(false)}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("dir.coNameReq")} className="sm:col-span-2">
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={subForm.name}
                onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
              />
            </Field>
            <Field label={t("dir.trade")}>
              <select
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={subForm.trade}
                onChange={(e) => setSubForm({ ...subForm, trade: e.target.value })}
              >
                <option value="">{t("dir.pickTrade")}</option>
                {TRADE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {tradeLabel(value)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("dir.contact")}>
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={subForm.contact}
                onChange={(e) => setSubForm({ ...subForm, contact: e.target.value })}
              />
            </Field>
            <Field label={t("common.phone")}>
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={subForm.phone}
                onChange={(e) => setSubForm({ ...subForm, phone: e.target.value })}
                placeholder="2123 4567"
              />
            </Field>
            <Field label={t("common.email")}>
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                type="email"
                value={subForm.email}
                onChange={(e) => setSubForm({ ...subForm, email: e.target.value })}
                placeholder="ops@vendor.com"
              />
            </Field>
            <Field label={t("dir.licenseNo")}>
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={subForm.licenseNo}
                onChange={(e) => setSubForm({ ...subForm, licenseNo: e.target.value })}
                placeholder={t("dir.licensePh")}
              />
            </Field>
            <Field label={t("dir.linkedUser")}>
              <select
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={subForm.userId}
                onChange={(e) => setSubForm({ ...subForm, userId: e.target.value })}
              >
                <option value="">{t("dir.noLink")}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("common.address")} className="sm:col-span-2">
              <input
                className="w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={subForm.address}
                onChange={(e) => setSubForm({ ...subForm, address: e.target.value })}
                placeholder={t("dir.addressPh")}
              />
            </Field>
            <Field label={t("common.notes")} className="sm:col-span-2">
              <textarea
                className="min-h-[72px] w-full rounded-xl border border-[var(--axon-line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--axon-steel)]"
                value={subForm.notes}
                onChange={(e) => setSubForm({ ...subForm, notes: e.target.value })}
                placeholder={t("dir.coNotesPh")}
              />
            </Field>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setSubOpen(false)}
              className="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              {t("common.cancel")}
            </button>
            <button
              disabled={busy || !subForm.name}
              onClick={saveSub}
              className="rounded-xl bg-[var(--axon-ink)] px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              {t("common.save")}
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
