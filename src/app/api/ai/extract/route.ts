import { NextRequest, NextResponse } from "next/server";
import {
  analysisModeForFieldIntent,
  extractFromInput,
  transcribeAudio,
  type FieldIntent,
} from "@/lib/ai";
import { requireSession } from "@/lib/session";
import { isProbablyImage } from "@/lib/media";

function parseFieldIntent(raw: unknown): FieldIntent | undefined {
  const v = String(raw || "").trim();
  if (v === "later" || v === "issue" || v === "done") return v;
  return undefined;
}

export async function POST(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const text = String(form.get("text") || "");
    const fieldIntent = parseFieldIntent(form.get("fieldIntent"));
    const analysisMode = analysisModeForFieldIntent(
      fieldIntent,
      String(form.get("analysisMode") || form.get("mode") || "discover") === "record"
        ? "record"
        : "discover",
    );
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
      analysisMode,
      fieldIntent,
    });
    return NextResponse.json(result);
  }

  const body = await req.json();
  const fieldIntent = parseFieldIntent(body.fieldIntent);
  const analysisMode = analysisModeForFieldIntent(
    fieldIntent,
    body.analysisMode === "record" ? "record" : "discover",
  );
  const result = await extractFromInput({
    text: body.text,
    imageBase64: body.imageBase64,
    imageMime: body.imageMime,
    filename: body.filename,
    mode: body.mode,
    analysisMode,
    fieldIntent,
    documentNote: body.documentNote,
  });
  return NextResponse.json(result);
}
