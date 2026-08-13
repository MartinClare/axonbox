/** Normalize stored upload paths to a viewable URL via authenticated file API. */
export function mediaUrl(filePath?: string | null): string | null {
  if (!filePath) return null;
  if (filePath.startsWith("blob:") || filePath.startsWith("data:")) return filePath;
  if (filePath.startsWith("/api/files/")) return filePath;
  if (filePath.startsWith("/uploads/")) {
    return `/api/files/${filePath.slice("/uploads/".length)}`;
  }
  if (filePath.startsWith("uploads/")) {
    return `/api/files/${filePath}`;
  }
  return filePath;
}

export function isProbablyImage(file: { type?: string; name?: string }) {
  const type = file.type || "";
  if (type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name || "");
}

/** Browsers (esp. Chrome on Windows) often cannot display HEIC. */
export function isBrowserUnsupportedImage(file: { type?: string; name?: string }) {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "").toLowerCase();
  return (
    type.includes("heic") ||
    type.includes("heif") ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}
