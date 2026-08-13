import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can, type Permission } from "@/lib/permissions";

/**
 * Resolve a live DB user for the current JWT session.
 * After reseed, JWT may hold deleted user ids — treat as logged out.
 */
export async function resolveLiveSession(): Promise<Session | null> {
  const session = await getServerSession(authOptions).catch((err) => {
    console.error("getServerSession failed", err);
    return null;
  });
  if (!session?.user) return null;

  try {
    const tokenId = (session.user as { id?: string }).id;
    let user = tokenId
      ? await prisma.user.findUnique({ where: { id: tokenId } })
      : null;

    if (!user && session.user.email) {
      user = await prisma.user.findUnique({
        where: { email: session.user.email },
      });
    }

    // Truly stale JWT (user deleted after reseed)
    if (!user) return null;

    (session.user as { id?: string; role?: string }).id = user.id;
    (session.user as { id?: string; role?: string }).role = user.role;
    session.user.name = user.name;
    session.user.email = user.email;
    return session;
  } catch (err) {
    // Transient DB blip — keep JWT so pages still open instead of false "stale"
    console.error("resolveLiveSession DB lookup failed (soft degrade)", err);
    return session;
  }
}

type SessionOk = { session: Session; error: null };
type SessionFail = { session: null; error: NextResponse };

/**
 * After DB reseed, JWT may still hold old user ids → FK crashes.
 * Resolve a live user (by id, then email) or force re-login.
 */
export async function requireSession(): Promise<SessionOk | SessionFail> {
  const session = await resolveLiveSession();
  if (!session?.user) {
    const raw = await getServerSession(authOptions).catch(() => null);
    if (raw?.user) {
      return {
        session: null,
        error: NextResponse.json(
          { error: "Session expired. Please login again.", code: "STALE_SESSION" },
          { status: 401 },
        ),
      };
    }
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { session, error: null };
}

/** Session + permission gate for commercial RBAC */
export async function requirePermission(permission: Permission) {
  const result = await requireSession();
  if (result.error) return result;
  const role = (result.session.user as { role?: string }).role;
  if (!can(role, permission)) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "權限不足", code: "FORBIDDEN", permission },
        { status: 403 },
      ),
    };
  }
  return result;
}

/** Safe FK for CaseEvent.actorId — null if user missing */
export async function resolveActorId(userId?: string | null) {
  if (!userId) return null;
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return u?.id ?? null;
  } catch {
    return null;
  }
}
