import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export async function saveUpload(file: File, subdir = "general") {
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || guessExt(file.type);
  const name = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  const relDir = path.join("uploads", subdir);
  const absDir = path.join(process.cwd(), "public", relDir);
  await mkdir(absDir, { recursive: true });
  const absPath = path.join(absDir, name);
  await writeFile(absPath, bytes);
  return {
    filePath: `/${relDir.replace(/\\/g, "/")}/${name}`,
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
  mime = "application/octet-stream"
) {
  const relDir = path.join("uploads", subdir);
  const absDir = path.join(process.cwd(), "public", relDir);
  await mkdir(absDir, { recursive: true });
  const absPath = path.join(absDir, filename);
  await writeFile(absPath, bytes);
  return {
    filePath: `/${relDir.replace(/\\/g, "/")}/${filename}`,
    mime,
  };
}
