export const TASK_COLUMNS = ["PENDING", "IN_PROGRESS", "PENDING_REVIEW", "DONE"] as const;
export type TaskColumnId = (typeof TASK_COLUMNS)[number];

export const TASK_LABELS = [
  { id: "green", hex: "#61bd4f", name: "綠" },
  { id: "yellow", hex: "#f2d600", name: "黃" },
  { id: "orange", hex: "#ff9f1a", name: "橙" },
  { id: "red", hex: "#eb5a46", name: "紅" },
  { id: "purple", hex: "#c377e0", name: "紫" },
  { id: "blue", hex: "#0079bf", name: "藍" },
  { id: "sky", hex: "#00c2e0", name: "青" },
  { id: "lime", hex: "#51e898", name: "檸" },
  { id: "pink", hex: "#ff78cb", name: "粉" },
  { id: "black", hex: "#344563", name: "黑" },
] as const;

export type TaskLabelId = (typeof TASK_LABELS)[number]["id"];

export const COLUMN_THEME: Record<
  TaskColumnId,
  { bar: string; bg: string; ink: string; name: string }
> = {
  PENDING: { bar: "#eb5a46", bg: "#fdecea", ink: "#9b2c20", name: "待處理" },
  IN_PROGRESS: { bar: "#ff9f1a", bg: "#fff4e5", ink: "#a85b00", name: "進行中" },
  PENDING_REVIEW: { bar: "#f2d600", bg: "#fff9d6", ink: "#7a6500", name: "待核驗" },
  DONE: { bar: "#61bd4f", bg: "#eaf6e7", ink: "#2d6a22", name: "已完成" },
};

export type TaskCheckItem = { id: string; text: string; checked: boolean };

export function labelMeta(id: string) {
  return TASK_LABELS.find((l) => l.id === id) || null;
}

export function parseLabels(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function parseChecklist(raw?: string | null): TaskCheckItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is TaskCheckItem =>
        Boolean(x) &&
        typeof x === "object" &&
        typeof (x as TaskCheckItem).id === "string" &&
        typeof (x as TaskCheckItem).text === "string",
    );
  } catch {
    return [];
  }
}

export function initials(name?: string | null) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0]}${parts[1][0]}`;
}
