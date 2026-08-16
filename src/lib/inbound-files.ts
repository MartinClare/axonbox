import JSZip from "jszip";
import { extractText } from "unpdf";

export type StoredInboundFile = {
  name: string;
  mime: string;
  base64: string;
};

export const MAX_FILE_BYTES = 8_000_000;
export const MAX_FILES = 8;

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
      const base64 = String(item.base64 || "").replace(/^data:[^;]+;base64,/, "");
      if (!base64) continue;
      out.push({
        name: String(item.name || item.filename || "attachment"),
        mime: String(item.mime || item.contentType || "application/octet-stream"),
        base64,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export function extOf(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m?.[1] || "";
}

export function isImageFile(file: { mime?: string; name?: string }) {
  if (file.mime?.startsWith("image/")) return true;
  return /^(jpe?g|png|gif|webp|bmp|heic|heif)$/.test(extOf(file.name || ""));
}

export function isDocumentFile(file: { mime?: string; name?: string }) {
  const mime = (file.mime || "").toLowerCase();
  const ext = extOf(file.name || "");
  return (
    mime.includes("pdf") ||
    mime.includes("word") ||
    mime.includes("officedocument.wordprocessing") ||
    /^(pdf|docx?)$/.test(ext)
  );
}

export function evidenceTypeFor(file: { mime?: string; name?: string }) {
  if (isImageFile(file)) return "PHOTO";
  if ((file.mime || "").startsWith("audio/")) return "VOICE";
  return "DOC";
}

export function emailRefersToAttachment(text: string) {
  return /附件|附上|附檔|請參[閱考]|詳見|見附件|as attached|see attached|please see|refer to|attached (pdf|doc|file)|please find/i.test(
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
  } catch (err) {
    console.error("[inbound-files] excerpt failed", file.name, err);
  }
  return "";
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
