import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { workflowFromEmail } from "@/lib/workflows/from-email";

/**
 * Email → AI workflow API
 *
 * POST /api/workflows/from-email
 * {
 *   "from": "safety@demo.com",
 *   "subject": "B区围栏缺失",
 *   "body": "请立即处理…",
 *   "imageBase64": "<optional photo>",
 *   "imageMime": "image/jpeg",
 *   "autoProcess": true   // default true → Event + Task
 * }
 *
 * Also accepts multipart: fields from/subject/body + file image
 */
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const contentType = req.headers.get("content-type") || "";
    let payload: {
      from?: string;
      subject?: string;
      body?: string;
      text?: string;
      imageBase64?: string;
      imageMime?: string;
      autoProcess?: boolean;
      attachments?: Array<{ name?: string; mime?: string; base64?: string }>;
    };

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") || form.get("image");
      let imageBase64: string | undefined;
      let imageMime: string | undefined;
      if (file instanceof File && file.size > 0) {
        const buf = Buffer.from(await file.arrayBuffer());
        imageBase64 = buf.toString("base64");
        imageMime = file.type || "image/jpeg";
      }
      payload = {
        from: String(form.get("from") || ""),
        subject: String(form.get("subject") || ""),
        body: String(form.get("body") || form.get("text") || ""),
        imageBase64,
        imageMime,
        autoProcess: String(form.get("autoProcess") || "true") !== "false",
      };
    } else {
      payload = await req.json();
    }

    const result = await workflowFromEmail({
      ...payload,
      userId: session!.user.id,
    });

    return NextResponse.json({
      ok: true,
      message: result.processed
        ? "郵件已分析並產生事件與任務"
        : "郵件已分析（未自動建任務）",
      ...result,
    });
  } catch (e) {
    console.error("[workflows.from-email]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "workflow failed" },
      { status: 400 },
    );
  }
}
