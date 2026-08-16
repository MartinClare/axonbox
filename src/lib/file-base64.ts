/** Browser helper: File → base64 (no data: prefix). Avoids FormData/CJK filename bugs. */
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

/**
 * Upload minutes as JSON base64 with upload progress + AI wait stage.
 * Same-origin cookies are included for NextAuth.
 */
export function uploadMinutesPreview(
  file: File,
  onProgress: (progress: MinutesProgress) => void,
): Promise<MinutesPreviewPayload> {
  return new Promise((resolve, reject) => {
    let aiTimer: number | undefined;
    const clearAi = () => {
      if (aiTimer !== undefined) window.clearInterval(aiTimer);
      aiTimer = undefined;
    };

    onProgress({ pct: 6, label: "讀取檔案…" });
    fileToBase64(file)
      .then((fileBase64) => {
        onProgress({ pct: 18, label: "準備上傳…" });

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/meetings");
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.withCredentials = true;

        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable || e.total <= 0) return;
          const up = 18 + Math.round((e.loaded / e.total) * 42);
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

        xhr.send(
          JSON.stringify({
            preview: true,
            fileName: file.name,
            mime: file.type || "",
            fileBase64,
          }),
        );
      })
      .catch((err) => {
        clearAi();
        reject(err instanceof Error ? err : new Error("讀取檔案失敗"));
      });
  });
}
