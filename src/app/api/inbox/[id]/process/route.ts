import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { processInboxToEventTask } from "@/lib/inbox";

type Params = { params: Promise<{ id: string }> };

/**
 * 收件 → AI 分析 → 事件 + 任务
 * POST /api/inbox/[id]/process
 */
export async function POST(req: Request, { params }: Params) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  let body: {
    assigneeId?: string;
    subcontractorId?: string;
    createTask?: boolean;
    splitTasks?: boolean;
    actionItems?: Array<{ title: string; detail?: string }>;
  } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  try {
    const result = await processInboxToEventTask({
      id,
      userId: session!.user.id,
      assigneeId: body.assigneeId,
      subcontractorId: body.subcontractorId,
      createTask: body.createTask !== false,
      splitTasks: Boolean(body.splitTasks),
      actionItems: Array.isArray(body.actionItems) ? body.actionItems : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "process failed" },
      { status: 400 },
    );
  }
}
