import { hasAfterEvidence } from "@/lib/case-closeout";
import { translate } from "@/lib/i18n/messages";
import type { UiLocale } from "@/lib/i18n/types";

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

const STEP_KEYS: Record<CaseLoopStepId, string> = {
  open: "loop.open",
  assign: "loop.assign",
  after: "loop.after",
  close: "loop.close",
};

export function caseLoopSubtitle(locale: UiLocale): string {
  return translate(locale, "loop.subtitle");
}

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
  if (String(input.status).toUpperCase() === "CLOSED" && isWaivedClose(input)) {
    return true;
  }
  return false;
}

export function getCaseLoopState(
  input: CaseLoopInput,
  locale: UiLocale = "zh-Hant",
): {
  steps: CaseLoopStep[];
  currentIndex: number;
  nextAction: CaseLoopNextAction;
  doneCount: number;
} {
  const closed = String(input.status).toUpperCase() === "CLOSED";
  const assigned = isAssigned(input);
  const after = hasAfterProof(input);

  const doneFlags = [true, assigned, after, closed];
  let currentIndex = doneFlags.findIndex((d) => !d);
  if (currentIndex < 0) currentIndex = 3;

  const ids: CaseLoopStepId[] = ["open", "assign", "after", "close"];
  const steps: CaseLoopStep[] = ids.map((id, i) => ({
    id,
    label: translate(locale, STEP_KEYS[id]),
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

export function nextActionCopy(
  action: CaseLoopNextAction,
  locale: UiLocale = "zh-Hant",
): {
  title: string;
  body: string;
  cta: string;
} {
  const t = (key: string) => translate(locale, key);
  switch (action) {
    case "assign":
      return {
        title: t("loop.next.assign.title"),
        body: t("loop.next.assign.body"),
        cta: t("loop.next.assign.cta"),
      };
    case "after_proof":
      return {
        title: t("loop.next.after.title"),
        body: t("loop.next.after.body"),
        cta: t("loop.next.after.cta"),
      };
    case "close":
      return {
        title: t("loop.next.close.title"),
        body: t("loop.next.close.body"),
        cta: t("loop.next.close.cta"),
      };
    case "pack":
      return {
        title: t("loop.next.pack.title"),
        body: t("loop.next.pack.body"),
        cta: t("loop.next.pack.cta"),
      };
    default:
      return {
        title: t("loop.title"),
        body: t("loop.subtitle"),
        cta: "",
      };
  }
}
