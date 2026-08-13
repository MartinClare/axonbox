import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

function bucketName() {
  return (
    process.env.BUCKET ||
    process.env.S3_BUCKET ||
    process.env.AWS_S3_BUCKET ||
    ""
  );
}

function accessKey() {
  return process.env.AWS_ACCESS_KEY_ID || process.env.ACCESS_KEY_ID || "";
}

function secretKey() {
  return process.env.AWS_SECRET_ACCESS_KEY || process.env.SECRET_ACCESS_KEY || "";
}

export function hasObjectStore() {
  return Boolean(bucketName() && accessKey() && secretKey());
}

let cached: S3Client | null = null;

function s3() {
  if (!cached) {
    cached = new S3Client({
      region: process.env.AWS_REGION || process.env.REGION || "auto",
      endpoint:
        process.env.AWS_ENDPOINT_URL ||
        process.env.ENDPOINT ||
        "https://storage.railway.app",
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: accessKey(),
        secretAccessKey: secretKey(),
      },
    });
  }
  return cached;
}

/** Map a stored filePath / URL to the object key (and local relative path). */
export function objectKeyFromPath(filePath: string) {
  let p = filePath.replace(/\\/g, "/");
  if (p.startsWith("/api/files/")) p = p.slice("/api/files/".length);
  if (p.startsWith("/uploads/")) p = p.slice("/uploads/".length);
  if (p.startsWith("uploads/")) p = p.slice("uploads/".length);
  if (p.startsWith("/")) p = p.slice(1);
  return p;
}

function localAbs(key: string) {
  return path.join(process.cwd(), "public", "uploads", key);
}

export async function putStoredFile(
  key: string,
  bytes: Buffer,
  contentType: string,
) {
  if (hasObjectStore()) {
    await s3().send(
      new PutObjectCommand({
        Bucket: bucketName(),
        Key: key,
        Body: bytes,
        ContentType: contentType,
      }),
    );
    return;
  }
  const abs = localAbs(key);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, bytes);
}

export async function getStoredFile(key: string): Promise<Buffer | null> {
  if (hasObjectStore()) {
    try {
      const res = await s3().send(
        new GetObjectCommand({ Bucket: bucketName(), Key: key }),
      );
      const arr = await res.Body?.transformToByteArray();
      return arr ? Buffer.from(arr) : null;
    } catch {
      return null;
    }
  }
  try {
    return await readFile(localAbs(key));
  } catch {
    return null;
  }
}
