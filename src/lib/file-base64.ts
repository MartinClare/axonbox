/** Browser helper: File → base64 (no data: prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const i = dataUrl.indexOf("base64,");
      resolve(i >= 0 ? dataUrl.slice(i + 7) : dataUrl);
    };
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/** Keep in sync with `MINUTES_MAX_BYTES` in src/lib/minutes.ts */
const MINUTES_UPLOAD_MAX_BYTES = 10_000_000;

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
  mock?: boolean;
  model?: string | null;
};

export type MinutesProgress = {
  pct: number;
  label: string;
};

export const MINUTES_PREVIEW_STORAGE_KEY = "axonbox:minutesPreview";

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

/** ASCII-safe multipart filename; real CJK name goes in a separate form field. */
function safeUploadName(file: File) {
  const m = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = m?.[1] || "bin";
  return `minutes.${ext}`;
}

/**
 * Upload minutes as multipart FormData (not JSON base64) so large PDFs
 * do not hit ~10MB JSON body truncation. CJK names travel in `fileName`.
 */
export function uploadMinutesPreview(
  file: File,
  onProgress: (progress: MinutesProgress) => void,
): Promise<MinutesPreviewPayload> {
  return new Promise((resolve, reject) => {
    if (file.size > MINUTES_UPLOAD_MAX_BYTES) {
      reject(
        new Error(
          `檔案過大（${(file.size / 1_000_000).toFixed(1)}MB）。請壓縮至 ${Math.floor(MINUTES_UPLOAD_MAX_BYTES / 1_000_000)}MB 以下，或轉成文字／較小 PDF。`,
        ),
      );
      return;
    }

    let aiTimer: number | undefined;
    const clearAi = () => {
      if (aiTimer !== undefined) window.clearInterval(aiTimer);
      aiTimer = undefined;
    };

    onProgress({ pct: 8, label: "準備上傳…" });

    const form = new FormData();
    form.append("file", file, safeUploadName(file));
    form.append("fileName", file.name);
    form.append("mime", file.type || "");
    form.append("preview", "1");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/meetings");
    xhr.withCredentials = true;

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

    xhr.send(form);
  });
}
