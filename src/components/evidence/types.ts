export type EvidenceCaseBrief = {
  id: string;
  caseNo: string;
  status: string;
  title: string;
};

export type EvidenceCaseDetail = EvidenceCaseBrief & {
  events: Array<{
    id: string;
    type: string;
    note: string | null;
    createdAt: string;
    actor?: { name: string } | null;
  }>;
};

export type EvidenceItem = {
  id: string;
  title: string;
  type: string;
  location: string | null;
  filePath: string | null;
  mime?: string | null;
  lat?: number | null;
  lng?: number | null;
  headingDeg?: number | null;
  chatText: string | null;
  status: string;
  source: string;
  category: string | null;
  severity: string | null;
  capturedAt: string;
  aiJson: string | null;
  exifJson: string | null;
  tagsJson?: string | null;
  caseId?: string | null;
  case?: (EvidenceCaseBrief | EvidenceCaseDetail) | null;
};

export type EvidenceFilters = {
  q: string;
  category: string;
  status: string;
  source: string;
  linked: "" | "1" | "0";
  sort: "capturedAt" | "createdAt";
  order: "asc" | "desc";
};

export const PAGE_SIZE = 36;

export function evidenceTags(item: EvidenceItem) {
  const raw = (() => {
    try {
      if (!item.tagsJson) return [];
      return JSON.parse(item.tagsJson) as unknown;
    } catch {
      return [];
    }
  })();
  if (!Array.isArray(raw)) return [] as string[];
  return raw.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
}

export function isEvidenceImage(item: EvidenceItem) {
  const path = item.filePath || "";
  if (!path) return false;
  const mime = (item.mime || "").toLowerCase();
  // Email signature GIFs are often typed PHOTO but look broken in the gallery.
  if (mime === "image/gif" || /\.gif$/i.test(path)) return false;
  if (mime.startsWith("image/")) return true;
  if (/\.(jpe?g|png|webp|bmp)$/i.test(path)) return true;
  // PHOTO without a real image path should fall back to the text tile, not a broken img.
  return false;
}
