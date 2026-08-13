import { prisma } from "./prisma";

export async function nextCaseNo(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const prefix = `C-${y}-${m}${d}-`;
  const count = await prisma.case.count({
    where: { caseNo: { startsWith: prefix } },
  });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}
