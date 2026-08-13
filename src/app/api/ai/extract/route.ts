import { NextRequest, NextResponse } from "next/server";
import { extractFromInput, transcribeAudio } from "@/lib/ai";
import { requireSession } from "@/lib/session";
import { isProbablyImage } from "@/lib/media";

export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const text = String(form.get("text") || "");
    const file = form.get("file");
    let imageBase64: string | undefined;
    let imageMime: string | undefined;
    let filename: string | undefined;
    let transcript = text;

    if (file instanceof File && file.size > 0) {
      filename = file.name;
      const buf = Buffer.from(await file.arrayBuffer());
      if (file.type.startsWith("audio/")) {
        const t = await transcribeAudio(buf, file.name);
        transcript = [text, t.text].filter(Boolean).join("\n");
      } else if (isProbablyImage(file)) {
        imageBase64 = buf.toString("base64");
        const lower = filename.toLowerCase();
        imageMime =
          file.type && file.type.startsWith("image/")
            ? file.type
            : lower.endsWith(".png")
              ? "image/png"
              : lower.endsWith(".webp")
                ? "image/webp"
                : lower.endsWith(".heic") || lower.endsWith(".heif")
                  ? "image/heic"
                  : "image/jpeg";
      } else {
        transcript = [text, `附件：${file.name}`].filter(Boolean).join("\n");
      }
    }

    const result = await extractFromInput({
      text: transcript,
      imageBase64,
      imageMime,
      filename,
    });
    return NextResponse.json(result);
  }

  const body = await req.json();
  const result = await extractFromInput({
    text: body.text,
    imageBase64: body.imageBase64,
    imageMime: body.imageMime,
    filename: body.filename,
  });
  return NextResponse.json(result);
}
