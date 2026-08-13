import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { generateReports } from "@/lib/reports/generate";
import type { ReportFormat } from "@/lib/reports/types";

/**
 * Event/safety/quality report export as Word or PDF (replaces Excel).
 * GET /api/reports/export?type=events|safety|quality&format=docx|pdf
 * Default format: docx
 */
export async function GET(req: NextRequest) {
  const { error } = await requireSession();
  if (error) return error;

  try {
    const type = req.nextUrl.searchParams.get("type") || "events";
    const format = (req.nextUrl.searchParams.get("format") || "docx") as ReportFormat;
    const kind =
      type === "safety" || type === "quality" || type === "events" || type === "cases"
        ? type === "cases"
          ? "events"
          : type
        : "events";

    const result = await generateReports({
      kind,
      formats: [format === "pdf" ? "pdf" : "docx"],
    });

    const file = result.exports[0];
    return NextResponse.json({
      ok: true,
      filePath: file?.filePath,
      filename: file?.filename,
      format: file?.format,
      summary: "summary" in result ? result.summary : undefined,
      exports: result.exports,
    });
  } catch (e) {
    console.error("[reports.export]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "export failed" },
      { status: 500 },
    );
  }
}
