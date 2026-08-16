/** Browser helper: File → base64 (no data: prefix). Avoids FormData/CJK filename bugs. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      const i = dataUrl.indexOf("base64,");
      resolve(i >= 0 ? dataUrl.slice(i + 7) : dataUrl);
    };
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsDataURL(file);
  });
}
