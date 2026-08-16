/** Encode a UTF-8 filename for X-File-Name header (base64). */
function encodeFileNameHeader(name: string) {
  const bytes = new TextEncoder().encode(name);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export type MinutesOutputLang = "original" | "zh" | "en";

export type MinutesPreviewPayload = {
  title: string;
  meetingAt: string | null;
  sourceName: string;
  rawText: string;
  actions: Array<{
    title: string;
    assigneeName: string | null;
    assigneeId: string | null;
    matchedName?: string | null;
    dueAt: string | null;
    notes: string | null;
  }>;
  outputLang?: MinutesOutputLang;
  mock?: boolean;
  model?: string | null;
};

export type MinutesProgress = {
  pct: number;
  label: string;
};

export const MINUTES_PREVIEW_STORAGE_KEY = "axonbox:minutesPreview";

/** Keep in sync with `MINUTES_MAX_BYTES` in src/lib/minutes.ts */
const MINUTES_UPLOAD_MAX_BYTES = 10_000_000;

/** Stash AI minutes analysis so Inbox can jump to /tasks analysis UI. */
export function stashMinutesPreview(payload: MinutesPreviewPayload) {
  try {
    sessionStorage.setItem(MINUTES_PREVIEW_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

export function takeMinutesPreview(): MinutesPreviewPayload | null {
  try {
    const raw = sessionStorage.getItem(MINUTES_PREVIEW_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(MINUTES_PREVIEW_STORAGE_KEY);
    return JSON.parse(raw) as MinutesPreviewPayload;
  } catch {
    return null;
  }
}

/**
 * Upload minutes as raw binary to /api/meetings/preview.
 * Avoids JSON base64 inflation that hit ~10MB proxy truncation.
 */
export function uploadMinutesPreview(
  file: File,
  onProgress: (progress: MinutesProgress) => void,
  opts?: { outputLang?: MinutesOutputLang },
): Promise<MinutesPreviewPayload> {
  return new Promise((resolve, reject) => {
    if (file.size > MINUTES_UPLOAD_MAX_BYTES) {
      reject(
        new Error(
          `檔案過大（${(file.size / 1_000_000).toFixed(1)}MB）。請壓縮至 ${Math.floor(MINUTES_UPLOAD_MAX_BYTES / 1_000_000)}MB 以下，或先轉成文字檔再上傳。`,
        ),
      );
      return;
    }

    let aiTimer: number | undefined;
    const clearAi = () => {
      if (aiTimer !== undefined) window.clearInterval(aiTimer);
      aiTimer = undefined;
    };

    const outputLang: MinutesOutputLang =
      opts?.outputLang === "zh" || opts?.outputLang === "en" ? opts.outputLang : "original";

    onProgress({ pct: 8, label: "準備上傳…" });

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/meetings/preview");
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeFileNameHeader(file.name));
    xhr.setRequestHeader("X-File-Mime", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-Output-Lang", outputLang);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || e.total <= 0) return;
      const up = 8 + Math.round((e.loaded / e.total) * 52);
      onProgress({ pct: Math.min(60, up), label: "上傳檔案…" });
    };

    xhr.upload.onload = () => {
      onProgress({ pct: 62, label: "AI 分析行動項目…" });
      let p = 62;
      aiTimer = window.setInterval(() => {
        p = Math.min(92, p + 1.2);
        onProgress({ pct: p, label: "AI 分析行動項目…" });
      }, 450);
    };

    xhr.onerror = () => {
      clearAi();
      reject(new Error("網路錯誤，請稍後再試"));
    };

    xhr.onload = () => {
      clearAi();
      let data: unknown = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = null;
      }
      if (xhr.status === 401) {
        reject(new Error("未授權，請重新登入"));
        return;
      }
      if (xhr.status === 404) {
        reject(new Error("請強制重新整理頁面後再試（Cmd+Shift+R / Ctrl+Shift+R）"));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const err =
          data && typeof data === "object" && data !== null && "error" in data
            ? String((data as { error?: string }).error || `錯誤 ${xhr.status}`)
            : `錯誤 ${xhr.status}`;
        reject(new Error(err));
        return;
      }
      onProgress({ pct: 100, label: "完成" });
      resolve(data as MinutesPreviewPayload);
    };

    xhr.send(file);
  });
}

/** Re-run minutes extract on stored text (no file re-upload). */
export async function repreviewMinutesText(opts: {
  rawText: string;
  fileName: string;
  outputLang?: MinutesOutputLang;
}): Promise<MinutesPreviewPayload> {
  const outputLang: MinutesOutputLang =
    opts.outputLang === "zh" || opts.outputLang === "en" ? opts.outputLang : "original";
  const res = await fetch("/api/meetings", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      preview: true,
      rawText: opts.rawText,
      fileName: opts.fileName,
      outputLang,
    }),
  });
  const data = (await res.json().catch(() => null)) as
    | (MinutesPreviewPayload & { error?: string })
    | null;
  if (!res.ok) {
    throw new Error(data?.error || `錯誤 ${res.status}`);
  }
  return {
    ...(data as MinutesPreviewPayload),
    outputLang: data?.outputLang || outputLang,
  };
}
