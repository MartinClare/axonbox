import { randomUUID } from "crypto";
import path from "path";
import { objectKeyFromPath, putStoredFile } from "./storage";

export async function saveUpload(file: File, subdir = "general") {
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || guessExt(file.type);
  const name = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  const key = `${subdir}/${name}`;
  await putStoredFile(key, bytes, file.type || "application/octet-stream");
  return {
    filePath: `/uploads/${key}`,
    mime: file.type || "application/octet-stream",
    bytes,
    originalName: file.name,
  };
}

function guessExt(mime: string) {
  if (mime.includes("png")) return ".png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return ".jpg";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("pdf")) return ".pdf";
  if (mime.includes("audio")) return ".webm";
  return ".bin";
}

export async function saveBuffer(
  bytes: Buffer,
  filename: string,
  subdir = "exports",
  mime = "application/octet-stream",
) {
  const key = `${subdir}/${filename}`;
  await putStoredFile(key, bytes, mime);
  return {
    filePath: `/uploads/${key}`,
    mime,
  };
}

export { objectKeyFromPath };
