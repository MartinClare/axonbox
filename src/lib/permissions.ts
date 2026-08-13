/** Enterprise-ready role permissions for commercial sale */

export type Role =
  | "OWNER"
  | "ADMIN"
  | "SUPERVISOR"
  | "VIEWER"
  | "SUBCONTRACTOR";

export type Permission =
  | "dashboard:read"
  | "cases:read"
  | "cases:write"
  | "cases:close"
  | "tasks:read"
  | "tasks:write"
  | "evidence:read"
  | "evidence:write"
  | "inbox:read"
  | "inbox:write"
  | "capture:use"
  | "reports:read"
  | "reports:generate"
  | "checklist:read"
  | "checklist:write"
  | "directory:read"
  | "directory:write"
  | "settings:read"
  | "settings:write"
  | "users:read"
  | "users:write"
  | "knowledge:ask"
  | "org:admin";

const ALL: Permission[] = [
  "dashboard:read",
  "cases:read",
  "cases:write",
  "cases:close",
  "tasks:read",
  "tasks:write",
  "evidence:read",
  "evidence:write",
  "inbox:read",
  "inbox:write",
  "capture:use",
  "reports:read",
  "reports:generate",
  "checklist:read",
  "checklist:write",
  "directory:read",
  "directory:write",
  "settings:read",
  "settings:write",
  "users:read",
  "users:write",
  "knowledge:ask",
  "org:admin",
];

const MATRIX: Record<Role, Permission[]> = {
  OWNER: ALL,
  ADMIN: ALL,
  SUPERVISOR: [
    "dashboard:read",
    "cases:read",
    "cases:write",
    "cases:close",
    "tasks:read",
    "tasks:write",
    "evidence:read",
    "evidence:write",
    "inbox:read",
    "inbox:write",
    "capture:use",
    "reports:read",
    "reports:generate",
    "checklist:read",
    "checklist:write",
    "directory:read",
    "settings:read",
    "knowledge:ask",
  ],
  VIEWER: [
    "dashboard:read",
    "cases:read",
    "tasks:read",
    "evidence:read",
    "inbox:read",
    "reports:read",
    "checklist:read",
    "directory:read",
    "settings:read",
    "knowledge:ask",
  ],
  SUBCONTRACTOR: [
    "dashboard:read",
    "cases:read",
    "tasks:read",
    "tasks:write",
    "evidence:read",
    "evidence:write",
    "capture:use",
    "checklist:read",
    "checklist:write",
    "knowledge:ask",
  ],
};

export const ROLE_LABELS_ENTERPRISE: Record<string, string> = {
  OWNER: "企業擁有人",
  ADMIN: "管理員",
  SUPERVISOR: "現場主管",
  VIEWER: "唯讀成員",
  SUBCONTRACTOR: "分判人員",
};

export function normalizeRole(role?: string | null): Role {
  const r = (role || "VIEWER").toUpperCase();
  if (r === "OWNER" || r === "ADMIN" || r === "SUPERVISOR" || r === "VIEWER" || r === "SUBCONTRACTOR") {
    return r;
  }
  // legacy
  if (r === "ADMIN") return "ADMIN";
  return "SUPERVISOR";
}

export function permissionsFor(role?: string | null): Permission[] {
  return MATRIX[normalizeRole(role)];
}

export function can(role: string | null | undefined, permission: Permission) {
  return permissionsFor(role).includes(permission);
}

export function assertCan(role: string | null | undefined, permission: Permission) {
  if (!can(role, permission)) {
    const err = new Error(`Forbidden: requires ${permission}`);
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}
