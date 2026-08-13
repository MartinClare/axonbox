import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error"],
  });

// Always reuse one client (avoids SQLite lock / connection storms)
globalForPrisma.prisma = prisma;
