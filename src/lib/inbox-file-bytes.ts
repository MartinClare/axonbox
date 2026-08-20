import { randomUUID } from "crypto";
import path from "path";
import {
  compactStoredFile,
  MAX_DOWNLOAD_BYTES,
  MAX_FILE_BYTES,
  type StoredInboundFile,
} from "@/lib/inbound-files";
import { getStoredFile, objectKeyFromPath } from "@/lib/storage";
import { saveBuffer } from "@/lib/upload";

export async function inboxFileBuffer(file: StoredInboundFile): Promise<Buffer | null> {
  if (file.base64) {
    try {
      return Buffer.from(file.base64, "base64");
    } catch {
      return null;
    }
  }
  if (file.filePath) {
    const stored = await getStoredFile(objectKeyFromPath(file.filePath));
    if (stored) return stored;
  }
  return downloadYCloudFile(file);
}

export async function persistLargeInboxFile(
  buf: Buffer,
  file: StoredInboundFile,
): Promise<StoredInboundFile> {
  const ext = path.extname(file.name) || guessExt(file.mime);
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  const saved = await saveBuffer(buf, filename, "inbox", file.mime);
  return compactStoredFile({
    ...file,
    filePath: saved.filePath,
    base64: undefined,
  });
}

export function shouldEmbedBase64(bytes: number) {
  return bytes > 0 && bytes <= MAX_FILE_BYTES;
}

async function downloadYCloudFile(file: StoredInboundFile): Promise<Buffer | null> {
  const apiKey = process.env.YCLOUD_API_KEY?.trim();
  const link = file.ycloudLink || "";
  if (!apiKey || !link) return null;
  try {
    const res = await fetch(link, { headers: { "X-API-Key": apiKey } });
    if (!res.ok) {
      console.error("[inbox] ycloud media download failed", res.status, file.name);
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_DOWNLOAD_BYTES) {
      console.warn("[inbox] ycloud media too large", buf.length, file.name);
      return null;
    }
    return buf;
  } catch (err) {
    console.error("[inbox] ycloud media download error", err);
    return null;
  }
}

function guessExt(mime: string) {
  if (mime.includes("pdf")) return ".pdf";
  if (mime.includes("png")) return ".png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("webp")) return ".webp";
  return "";
}
