import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/session";
import { askEngineering } from "@/lib/knowledge/ask";

export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const { error } = await requirePermission("knowledge:ask");
  if (error) return error;
  try {
    const body = await req.json();
    const question = String(body.question || body.q || "").trim();
    if (!question) {
      return NextResponse.json({ error: "請輸入問題" }, { status: 400 });
    }
    if (question.length > 2000) {
      return NextResponse.json({ error: "問題過長，請精簡至 2000 字內" }, { status: 400 });
    }
    const result = await askEngineering(question);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "分析失敗，請稍後再試" }, { status: 500 });
  }
}
