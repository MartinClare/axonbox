import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { requireSession } from "@/lib/session";
import { getStoredFile, objectKeyFromPath } from "@/lib/storage";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".webm": "audio/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

/**
 * Serve uploads (evidence photos, exports) with correct MIME.
 * Path example: /api/files/evidence/xxx.jpg  → uploads/evidence/xxx.jpg
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { error } = await requireSession();
  if (error) return error;
  const { path: parts } = await ctx.params;
  const rel = parts.join("/");
  if (!rel || rel.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  const key = objectKeyFromPath(rel);
  const buf = await getStoredFile(key);
  if (!buf) {
    return NextResponse.json({ error: "File not found", path: rel }, { status: 404 });
  }
  const ext = path.extname(key).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  const inline =
    type.startsWith("image/") ||
    type.startsWith("audio/") ||
    ext === ".pdf" ||
    ext === ".html";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${path.basename(key)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
