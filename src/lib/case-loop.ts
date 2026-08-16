import { hasAfterEvidence } from "@/lib/case-closeout";

export type CaseLoopStepId = "open" | "assign" | "after" | "close";

export type CaseLoopNextAction =
  | "none"
  | "assign"
  | "after_proof"
  | "close"
  | "pack";

export type CaseLoopStep = {
  id: CaseLoopStepId;
  label: string;
  done: boolean;
  current: boolean;
};

export type CaseLoopInput = {
  status: string;
  assigneeId?: string | null;
  subcontractorId?: string | null;
  evidence: Array<{
    id: string;
    createdAt: Date | string;
    tagsJson?: string | null;
  }>;
  events: Array<{
    type: string;
    createdAt: Date | string;
  }>;
};

export const CASE_LOOP_LABELS: Record<CaseLoopStepId, string> = {
  open: "開立",
  assign: "指派",
  after: "整改後",
  close: "結案",
};

export const CASE_LOOP_SUBTITLE = "開立 → 指派 → 整改後 → 結案";

function isAssigned(input: CaseLoopInput): boolean {
  const status = String(input.status || "").toUpperCase();
  if (status !== "OPEN" && status !== "") return true;
  return Boolean(input.assigneeId || input.subcontractorId);
}

function isWaivedClose(input: CaseLoopInput): boolean {
  return input.events.some((e) => String(e.type).toUpperCase() === "CLOSE_WAIVE");
}

function hasAfterProof(input: CaseLoopInput): boolean {
  if (hasAfterEvidence(input.evidence, input.events)) return true;
  // Closed without photos still completes the after step via waive.
  if (String(input.status).toUpperCase() === "CLOSED" && isWaivedClose(input)) {
    return true;
  }
  return false;
}

export function getCaseLoopState(input: CaseLoopInput): {
  steps: CaseLoopStep[];
  currentIndex: number;
  nextAction: CaseLoopNextAction;
  doneCount: number;
} {
  const closed = String(input.status).toUpperCase() === "CLOSED";
  const assigned = isAssigned(input);
  const after = hasAfterProof(input);

  const doneFlags = [true, assigned, after, closed];
  // First incomplete step; if all done, currentIndex = last.
  let currentIndex = doneFlags.findIndex((d) => !d);
  if (currentIndex < 0) currentIndex = 3;

  const ids: CaseLoopStepId[] = ["open", "assign", "after", "close"];
  const steps: CaseLoopStep[] = ids.map((id, i) => ({
    id,
    label: CASE_LOOP_LABELS[id],
    done: closed ? true : doneFlags[i],
    current: !closed && i === currentIndex,
  }));

  let nextAction: CaseLoopNextAction = "none";
  if (closed) nextAction = "pack";
  else if (!assigned) nextAction = "assign";
  else if (!after) nextAction = "after_proof";
  else nextAction = "close";

  return {
    steps,
    currentIndex: closed ? 3 : currentIndex,
    nextAction,
    doneCount: steps.filter((s) => s.done).length,
  };
}

export function nextActionCopy(action: CaseLoopNextAction): {
  title: string;
  body: string;
  cta: string;
} {
  switch (action) {
    case "assign":
      return {
        title: "下一步：指派",
        body: "指定分判／負責人與期限，並送出整改指示。",
        cta: "去指派",
      };
    case "after_proof":
      return {
        title: "下一步：整改後證據",
        body: "在附件標記「整改後」照片，才能核驗結案。",
        cta: "去標記附件",
      };
    case "close":
      return {
        title: "下一步：結案",
        body: "已有整改後證據，可核驗通過並關閉事件。",
        cta: "核驗並關閉",
      };
    case "pack":
      return {
        title: "已結案",
        body: "監督迴圈完成。可下載結案摘要 PDF 存檔或交給業主。",
        cta: "下載結案摘要",
      };
    default:
      return {
        title: "監督迴圈",
        body: CASE_LOOP_SUBTITLE,
        cta: "",
      };
  }
}
