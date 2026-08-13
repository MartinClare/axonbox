import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasAIKey } from "@/lib/ai";

/** Public health check — no auth. Used by UI banner + ops scripts. */
export async function GET() {
  const headers = {
    "Cache-Control": "no-store, max-age=0",
  };
  try {
    await prisma.user.count();
    return NextResponse.json(
      {
        ok: true,
        service: "AxonBox",
        db: "up",
        ai: hasAIKey(),
        time: new Date().toISOString(),
      },
      { headers },
    );
  } catch (err) {
    console.error("health check failed", err);
    return NextResponse.json(
      {
        ok: false,
        service: "AxonBox",
        db: "down",
        ai: hasAIKey(),
        time: new Date().toISOString(),
      },
      { status: 503, headers },
    );
  }
}
