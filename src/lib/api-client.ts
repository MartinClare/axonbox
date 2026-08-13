"use client";

import { signOut } from "next-auth/react";

export type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; code?: string; status: number; data?: unknown };

async function parseBody(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  const text = await res.text().catch(() => "");
  return text ? { message: text } : null;
}

/**
 * Safe fetch for app pages — never throws; handles stale session.
 * Retries once on network failure (common when server just restarted).
 */
export async function apiFetch<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  const maxAttempts = 2;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(input, init);
      const data = await parseBody(res);

      if (res.status === 401) {
        const code =
          data && typeof data === "object" && data !== null && "code" in data
            ? String((data as { code?: string }).code || "")
            : "";
        if (code === "STALE_SESSION") {
          await signOut({ callbackUrl: "/login?reason=stale" }).catch(() => {
            window.location.assign("/login?reason=stale");
          });
        }
        return {
          ok: false,
          error:
            data && typeof data === "object" && data !== null && "error" in data
              ? String((data as { error?: string }).error || "未授權")
              : "未授權",
          code: code || "UNAUTHORIZED",
          status: 401,
          data,
        };
      }

      if (!res.ok) {
        const error =
          data && typeof data === "object" && data !== null && "error" in data
            ? String((data as { error?: string }).error || `錯誤 ${res.status}`)
            : `錯誤 ${res.status}`;
        return { ok: false, error, status: res.status, data };
      }

      return { ok: true, data: data as T, status: res.status };
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 400 * attempt));
        continue;
      }
    }
  }

  console.error("apiFetch failed", lastErr);
  return { ok: false, error: "網路錯誤，請確認伺服器已啟動後再試", status: 0 };
}

export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
