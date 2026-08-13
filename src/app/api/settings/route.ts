import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { hasAIKey, getAIModel } from "@/lib/ai";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const [project, users, subcontractors, exports] = await Promise.all([
    prisma.project.findFirst(),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        title: true,
        company: true,
      },
    }),
    prisma.subcontractor.findMany({
      orderBy: { createdAt: "asc" },
    }),
    prisma.reportExport.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  return NextResponse.json({
    project,
    users,
    subcontractors,
    exports,
    aiConfigured: hasAIKey(),
    aiModel: hasAIKey() ? getAIModel() : null,
    aiProvider: process.env.OPENROUTER_API_KEY ? "openrouter" : process.env.OPENAI_API_KEY ? "openai" : null,
  });
}

export async function PATCH(req: Request) {
  const { error } = await requireSession();
  if (error) return error;
  const body = await req.json();
  if (!body.projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  const project = await prisma.project.update({
    where: { id: body.projectId },
    data: {
      name: body.name,
      siteCode: body.siteCode,
      address: body.address,
      weather: body.weather,
    },
  });
  return NextResponse.json(project);
}
