import JSZip from "jszip";
import { extractText } from "unpdf";
import { extOf } from "@/lib/inbound-files";

export const MINUTES_MAX_CHARS = 20_000;
export const MINUTES_MAX_BYTES = 12_000_000;

export function isMinutesFile(file: { mime?: string; name?: string }) {
  const mime = (file.mime || "").toLowerCase();
  const ext = extOf(file.name || "");
  return (
    mime.includes("pdf") ||
    mime.includes("word") ||
    mime.includes("officedocument.wordprocessing") ||
    mime.startsWith("text/") ||
    /^(pdf|docx?|txt|md)$/.test(ext)
  );
}

function cleanMinutesText(text: string) {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MINUTES_MAX_CHARS);
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

/** Full-document text for meeting minutes (higher limit than email excerpts). */
export async function extractMinutesText(
  buf: Buffer,
  file: { mime?: string; name?: string },
): Promise<string> {
  const ext = extOf(file.name || "");
  const mime = (file.mime || "").toLowerCase();
  try {
    if (mime.includes("pdf") || ext === "pdf") {
      const { text } = await extractText(new Uint8Array(buf), { mergePages: true });
      return cleanMinutesText(Array.isArray(text) ? text.join("\n") : text || "");
    }
    if (mime.includes("word") || ext === "docx") {
      return cleanMinutesText(await textFromDocx(buf));
    }
    if (ext === "doc") {
      return "";
    }
    if (mime.startsWith("text/") || /^(txt|md)$/.test(ext)) {
      return cleanMinutesText(buf.toString("utf8"));
    }
  } catch (err) {
    console.error("[minutes] extract failed", file.name, err);
  }
  return "";
}

export type DirectoryUser = {
  id: string;
  name: string;
  email?: string | null;
  company?: string | null;
};

/** Match assignee name from minutes to a directory user. */
export function matchAssigneeByName(
  name: string | null | undefined,
  users: DirectoryUser[],
): DirectoryUser | null {
  const raw = String(name || "").trim();
  if (!raw || users.length === 0) return null;
  const needle = raw.toLowerCase();

  const exact = users.find(
    (u) =>
      u.name.toLowerCase() === needle ||
      (u.email && u.email.toLowerCase() === needle) ||
      (u.email && u.email.toLowerCase().split("@")[0] === needle),
  );
  if (exact) return exact;

  const contains = users.find(
    (u) =>
      u.name.toLowerCase().includes(needle) ||
      needle.includes(u.name.toLowerCase()) ||
      (u.company && u.company.toLowerCase().includes(needle)),
  );
  return contains || null;
}
