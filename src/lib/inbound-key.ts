import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getInboundAddress, inboundDomain, mailboxAlias } from "@/lib/email-inbound";

const WEAK_KEYS = new Set([
  "admin",
  "supervisor",
  "sub",
  "user",
  "test",
  "record",
  "demo",
  "inbox",
  "site",
  "mail",
  "owner",
  "staff",
]);

export function normalizeInboundKey(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
}

export function generateInboundKey() {
  return randomBytes(16).toString("hex");
}

export function isWeakInboundKey(key?: string | null) {
  const normalized = normalizeInboundKey(key || "");
  if (!normalized || normalized.length < 20) return true;
  if (WEAK_KEYS.has(normalized)) return true;
  if (/^[a-z]+$/.test(normalized)) return true;
  return false;
}

export function inboundMailboxDomain(orgAddress?: string | null) {
  return inboundDomain(getInboundAddress(orgAddress));
}

export function inboundAddressForKey(key: string, orgAddress?: string | null) {
  const domain = inboundMailboxDomain(orgAddress);
  const normalized = normalizeInboundKey(key);
  if (!domain || !normalized) return "";
  return `${normalized}@${domain}`;
}

export async function uniqueInboundKey(exceptUserId?: string) {
  for (let i = 0; i < 8; i++) {
    const candidate = generateInboundKey();
    const taken = await prisma.user.findFirst({
      where: {
        inboundKey: candidate,
        ...(exceptUserId ? { id: { not: exceptUserId } } : {}),
      },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return generateInboundKey();
}

export async function ensureUserInboundKey(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  if (user.inboundKey && !isWeakInboundKey(user.inboundKey)) return user;
  const inboundKey = await uniqueInboundKey(user.id);
  return prisma.user.update({
    where: { id: user.id },
    data: { inboundKey },
  });
}

export async function ensureAllInboundKeys() {
  const users = await prisma.user.findMany({
    select: { id: true, inboundKey: true },
  });
  for (const user of users) {
    if (user.inboundKey && !isWeakInboundKey(user.inboundKey)) continue;
    const inboundKey = await uniqueInboundKey(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { inboundKey } });
  }
}

export async function resolveUserByMailbox(addressOrKey?: string | null) {
  const key = normalizeInboundKey(mailboxAlias(addressOrKey) || addressOrKey || "");
  if (!key) return null;
  return prisma.user.findFirst({
    where: { inboundKey: key },
    select: { id: true, name: true, email: true, inboundKey: true },
  });
}
