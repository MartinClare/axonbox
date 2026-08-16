import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import {
  ROLE_LABELS_ENTERPRISE,
  permissionsFor,
  type Role,
} from "@/lib/permissions";

export async function GET() {
  const { session, error } = await requirePermission("settings:read");
  if (error) return error;

  let org = await prisma.orgSettings.findFirst();
  if (!org) {
    org = await prisma.orgSettings.create({
      data: { name: "AxonBox Enterprise", plan: "ENTERPRISE" },
    });
  }

  const role = ((session.user as { role?: string }).role || "VIEWER") as Role;
  return NextResponse.json({
    org,
    myRole: role,
    myPermissions: permissionsFor(role),
    roleLabels: ROLE_LABELS_ENTERPRISE,
    matrix: Object.fromEntries(
      (Object.keys(ROLE_LABELS_ENTERPRISE) as Role[]).map((r) => [
        r,
        permissionsFor(r),
      ]),
    ),
  });
}

export async function PATCH(req: NextRequest) {
  const { error } = await requirePermission("org:admin");
  if (error) return error;
  const body = await req.json();
  let org = await prisma.orgSettings.findFirst();
  if (!org) {
    org = await prisma.orgSettings.create({
      data: {
        name: String(body.name || "AxonBox Enterprise"),
        plan: String(body.plan || "ENTERPRISE"),
        allowSubInvite: body.allowSubInvite !== false,
        requireApproval: body.requireApproval !== false,
        inboundEmail: body.inboundEmail ? String(body.inboundEmail).trim() : undefined,
      },
    });
  } else {
    org = await prisma.orgSettings.update({
      where: { id: org.id },
      data: {
        name: body.name != null ? String(body.name) : undefined,
        plan: body.plan != null ? String(body.plan) : undefined,
        allowSubInvite:
          body.allowSubInvite != null ? Boolean(body.allowSubInvite) : undefined,
        requireApproval:
          body.requireApproval != null ? Boolean(body.requireApproval) : undefined,
        inboundEmail:
          body.inboundEmail != null
            ? String(body.inboundEmail).trim() || null
            : undefined,
      },
    });
  }
  return NextResponse.json(org);
}
