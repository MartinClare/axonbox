import JSZip from "jszip";
import { extractText } from "unpdf";

export type StoredInboundFile = {
  name: string;
  mime: string;
  base64?: string;
  filePath?: string;
  ycloudId?: string;
  ycloudLink?: string;
};

export const MAX_FILE_BYTES = 8_000_000;
/** WhatsApp PDFs can exceed the JSON-in-DB cap; still keep a downloadable copy. */
export const MAX_DOWNLOAD_BYTES = 50_000_000;
export const MAX_FILES = 8;

export function compactStoredFile(file: StoredInboundFile): StoredInboundFile {
  const base64 = file.base64?.replace(/^data:[^;]+;base64,/, "") || undefined;
  return {
    name: file.name || "attachment",
    mime: file.mime || "application/octet-stream",
    ...(base64 ? { base64 } : {}),
    ...(file.filePath ? { filePath: file.filePath } : {}),
    ...(file.ycloudId ? { ycloudId: file.ycloudId } : {}),
    ...(file.ycloudLink ? { ycloudLink: file.ycloudLink } : {}),
  };
}

function fileIdentity(file: StoredInboundFile) {
  return file.ycloudId || file.ycloudLink || file.filePath || file.name.toLowerCase();
}

export function parseInboxAttachments(raw?: string | null): StoredInboundFile[] {
  if (!raw) return [];
  try {
    const atts = JSON.parse(raw);
    if (!Array.isArray(atts)) return [];
    const out: StoredInboundFile[] = [];
    for (const item of atts) {
      if (typeof item === "string" && item.startsWith("data:")) {
        const m = item.match(/^data:([^;]+);base64,(.+)$/);
        if (!m) continue;
        out.push({ name: "attachment", mime: m[1], base64: m[2] });
        continue;
      }
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const base64 = String(rec.base64 || "").replace(/^data:[^;]+;base64,/, "");
      const filePath = String(rec.filePath || "").trim();
      const ycloudId = String(rec.ycloudId || rec.id || "").trim();
      const ycloudLink = String(rec.ycloudLink || rec.link || "").trim();
      const name = String(rec.name || rec.filename || "attachment");
      if (!base64 && !filePath && !ycloudLink && !ycloudId) continue;
      out.push(
        compactStoredFile({
          name,
          mime: String(rec.mime || rec.contentType || rec.mime_type || "application/octet-stream"),
          base64: base64 || undefined,
          filePath: filePath || undefined,
          ycloudId: ycloudId || undefined,
          ycloudLink: ycloudLink || undefined,
        }),
      );
    }
    return out;
  } catch {
    return [];
  }
}

type RawMedia = {
  id?: string;
  link?: string;
  filename?: string;
  mime_type?: string;
  mimeType?: string;
};

function stubFromRawMedia(media: RawMedia | null | undefined, fallbackName: string): StoredInboundFile | null {
  if (!media || typeof media !== "object") return null;
  const name = String(media.filename || fallbackName).trim();
  const ycloudId = String(media.id || "").trim();
  const ycloudLink = String(media.link || "").trim();
  if (!name && !ycloudId && !ycloudLink) return null;
  return compactStoredFile({
    name: name || fallbackName,
    mime: String(media.mime_type || media.mimeType || "application/octet-stream"),
    ycloudId: ycloudId || undefined,
    ycloudLink: ycloudLink || undefined,
  });
}

export function mediaStubsFromRawPayload(rawPayload?: string | null): StoredInboundFile[] {
  if (!rawPayload) return [];
  try {
    const raw = JSON.parse(rawPayload) as Record<string, unknown>;
    if (!raw || typeof raw !== "object") return [];
    const out: StoredInboundFile[] = [];
    const push = (file: StoredInboundFile | null) => {
      if (!file) return;
      const key = fileIdentity(file);
      if (out.some((f) => fileIdentity(f) === key || f.name === file.name)) return;
      out.push(file);
    };
    push(stubFromRawMedia(raw.document as RawMedia, "document.pdf"));
    push(stubFromRawMedia(raw.image as RawMedia, "image.jpg"));
    push(stubFromRawMedia(raw.audio as RawMedia, "audio.ogg"));
    if (Array.isArray(raw.mediaFiles)) {
      for (const item of raw.mediaFiles) push(stubFromRawMedia(item as RawMedia, "file"));
    }
    return out;
  } catch {
    return [];
  }
}

/** Stored attachments plus WhatsApp media that never made it into the JSON blob. */
export function resolveInboxFiles(
  attachments?: string | null,
  rawPayload?: string | null,
): StoredInboundFile[] {
  const stored = parseInboxAttachments(attachments);
  const extras = mediaStubsFromRawPayload(rawPayload);
  const out = [...stored];
  for (const extra of extras) {
    const key = fileIdentity(extra);
    if (out.some((f) => fileIdentity(f) === key || f.name === extra.name)) continue;
    out.push(extra);
  }
  return selectInboundAttachments(
    out.map((file) => ({
      ...file,
      bytes: file.base64 ? Math.ceil(file.base64.length * 0.75) : 0,
    })),
  );
}

export function extOf(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m?.[1] || "";
}

export function isImageFile(file: { mime?: string; name?: string }) {
  if (file.mime?.startsWith("image/")) return true;
  return /^(jpe?g|png|gif|webp|bmp|heic|heif)$/.test(extOf(file.name || ""));
}

export function isAudioFile(file: { mime?: string; name?: string }) {
  if (file.mime?.startsWith("audio/")) return true;
  return /\.(ogg|opus|mp3|m4a|wav|webm|aac)$/i.test(file.name || "");
}

export type AttachmentMeta = {
  name?: string;
  mime?: string;
  bytes?: number;
  contentDisposition?: string;
  cid?: string;
  related?: boolean;
};

export function isSpreadsheetFile(file: { mime?: string; name?: string }) {
  const mime = (file.mime || "").toLowerCase();
  const ext = extOf(file.name || "");
  return (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    /^(xlsx?|xlsm|xlsb|csv)$/.test(ext)
  );
}

export function isDocumentFile(file: { mime?: string; name?: string }) {
  const mime = (file.mime || "").toLowerCase();
  const ext = extOf(file.name || "");
  return (
    isSpreadsheetFile(file) ||
    mime.includes("pdf") ||
    mime.includes("word") ||
    mime.includes("officedocument.wordprocessing") ||
    mime.includes("officedocument.presentation") ||
    mime.includes("ms-powerpoint") ||
    /^(pdf|docx?|pptx?)$/.test(ext)
  );
}

/** Outlook/Gmail signature logos and CID images from quoted mail — not case files. */
export function isInlineOrSignatureImage(file: AttachmentMeta) {
  if (!isImageFile(file)) return false;
  const name = (file.name || "").toLowerCase();
  const disp = (file.contentDisposition || "").toLowerCase();
  if (file.related) return true;
  if (disp === "inline") return true;
  if (file.cid) return true;
  if (/^image\d{2,4}\.(png|jpe?g|gif|bmp|webp)$/i.test(name)) return true;
  if (/(^|[-_ .])(logo|signature|sig)([-_ .]|$)/i.test(name)) return true;
  if (/^cid:/i.test(name) || /@/.test(name)) return true;
  const bytes = file.bytes ?? 0;
  if (bytes > 0 && bytes < 80_000) return true;
  return false;
}

function attachmentRank(file: AttachmentMeta) {
  if (isSpreadsheetFile(file)) return 100;
  if (isDocumentFile(file)) return 80;
  if (isImageFile(file) && !isInlineOrSignatureImage(file)) return 30;
  if (isAudioFile(file)) return 20;
  return 10;
}

/** Keep real documents (Excel/PDF/Word) and drop thread logos before applying the cap. */
export function selectInboundAttachments<T extends AttachmentMeta>(
  files: T[],
  max = MAX_FILES,
): T[] {
  const kept = files.filter((file) => !isInlineOrSignatureImage(file));
  return kept
    .map((file, index) => ({ file, index, rank: attachmentRank(file) }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index)
    .slice(0, max)
    .sort((a, b) => a.index - b.index)
    .map((row) => row.file);
}

export function evidenceTypeFor(file: { mime?: string; name?: string }) {
  if (isImageFile(file)) return "PHOTO";
  if ((file.mime || "").startsWith("audio/")) return "VOICE";
  return "DOC";
}

export function emailRefersToAttachment(text: string) {
  return /附件|附上|附檔|請參[閱考]|詳見|見附件|as attached|see attached|please see|refer to|attached (pdf|doc|file|excel|xlsx?|spreadsheet)|please find|traffic (flow|forecast|data)|請(?:查收|參閱).{0,40}(?:excel|xlsx|附件)/i.test(
    text,
  );
}

export function emailIsThin(text: string) {
  const t = text.replace(/主题：/g, "").trim();
  return t.length < 50;
}

export async function excerptFromDocument(buf: Buffer, file: { mime?: string; name?: string }) {
  const ext = extOf(file.name || "");
  const mime = (file.mime || "").toLowerCase();
  try {
    if (mime.includes("pdf") || ext === "pdf") {
      const { text } = await extractText(new Uint8Array(buf), { mergePages: true });
      return cleanExcerpt(Array.isArray(text) ? text.join("\n") : text);
    }
    if (mime.includes("word") || ext === "docx") {
      return cleanExcerpt(await textFromDocx(buf));
    }
    if (isSpreadsheetFile(file)) {
      return cleanExcerpt(await textFromSpreadsheet(buf, ext));
    }
  } catch (err) {
    console.error("[inbound-files] excerpt failed", file.name, err);
  }
  return "";
}

async function textFromSpreadsheet(buf: Buffer, ext: string) {
  if (ext === "xls") return "";
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buf as never);
  const lines: string[] = [];
  for (const sheet of workbook.worksheets.slice(0, 3)) {
    lines.push(`Sheet: ${sheet.name}`);
    let n = 0;
    sheet.eachRow({ includeEmpty: false }, (row) => {
      if (n >= 8) return;
      const cells = Array.isArray(row.values)
        ? row.values
            .slice(1)
            .map((v) => (v == null ? "" : String(typeof v === "object" && v && "text" in v ? (v as { text: string }).text : v)))
            .join("\t")
        : "";
      if (cells.trim()) {
        lines.push(cells);
        n += 1;
      }
    });
  }
  return lines.join("\n");
}

async function textFromDocx(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return "";
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:p[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function cleanExcerpt(text: string) {
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1800);
}
