import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/session";
import { generateReports, type ReportKind } from "@/lib/reports/generate";
import type { ReportFormat } from "@/lib/reports/types";

export async function POST(req: NextRequest) {
  const { session, error } = await requirePermission("reports:generate");
  if (error) return error;

  try {
    let body: {
      kind?: ReportKind;
      date?: string;
      formats?: ReportFormat[];
    } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const result = await generateReports({
      kind: body.kind || "daily",
      date: body.date,
      formats: body.formats,
      reporterName: session.user.name || undefined,
    });

    return NextResponse.json({
      ok: true,
      message: "報告已產生",
      ...result,
    });
  } catch (e) {
    console.error("[reports.generate]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "generate failed" },
      { status: 500 },
    );
  }
}
