/** Field photo purpose: later = store only; issue = defect now; done = work finished. */
export type FieldIntent = "later" | "issue" | "done";

export function analysisModeForFieldIntent(
  fieldIntent?: FieldIntent | string | null,
  analysisMode?: "record" | "discover",
): "record" | "discover" {
  if (fieldIntent === "done" || fieldIntent === "later") return "record";
  if (fieldIntent === "issue") return "discover";
  return analysisMode === "record" ? "record" : "discover";
}

export function tagsForFieldIntent(fieldIntent?: FieldIntent | string | null): string[] {
  if (fieldIntent === "later") return ["稍後整理"];
  if (fieldIntent === "issue") return ["發現"];
  if (fieldIntent === "done") return ["完工", "完成作業"];
  return [];
}
