/** Close-out evidence helpers for private-project supervision loop. */

const AFTER_TAGS = new Set(["after", "整改後", "closeout", "整改后"]);

export function parseEvidenceTags(tagsJson: string | null | undefined): string[] {
  if (!tagsJson) return [];
  try {
    const parsed = JSON.parse(tagsJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.replace(/^#/, "").trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function tagsIncludeAfter(tagsJson: string | null | undefined): boolean {
  return parseEvidenceTags(tagsJson).some((t) => AFTER_TAGS.has(t.toLowerCase()) || AFTER_TAGS.has(t));
}

export function ensureAfterTag(tagsJson: string | null | undefined): string {
  const tags = parseEvidenceTags(tagsJson);
  if (!tags.some((t) => AFTER_TAGS.has(t.toLowerCase()) || AFTER_TAGS.has(t))) {
    tags.push("整改後");
  }
  return JSON.stringify([...new Set(tags)].slice(0, 20));
}

type EvidenceLike = {
  id: string;
  createdAt: Date | string;
  tagsJson?: string | null;
};

type EventLike = {
  type: string;
  createdAt: Date | string;
};

/** Latest ASSIGN or progress-start timestamp used as the before/after split. */
export function remediationStartedAt(events: EventLike[]): Date | null {
  const starts = events.filter((e) =>
    ["ASSIGN", "PROGRESS", "IN_PROGRESS"].includes(String(e.type).toUpperCase()),
  );
  if (starts.length === 0) return null;
  let latest = new Date(starts[0].createdAt);
  for (const e of starts) {
    const d = new Date(e.createdAt);
    if (d > latest) latest = d;
  }
  return latest;
}

export function isAfterEvidence(
  evidence: EvidenceLike,
  events: EventLike[],
): boolean {
  if (tagsIncludeAfter(evidence.tagsJson)) return true;
  const start = remediationStartedAt(events);
  if (!start) return false;
  return new Date(evidence.createdAt) > start;
}

export function findAfterEvidence<T extends EvidenceLike>(
  evidence: T[],
  events: EventLike[],
): T[] {
  return evidence.filter((e) => isAfterEvidence(e, events));
}

export function hasAfterEvidence(
  evidence: EvidenceLike[],
  events: EventLike[],
): boolean {
  return findAfterEvidence(evidence, events).length > 0;
}
