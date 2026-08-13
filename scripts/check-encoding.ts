import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const cases = await p.case.findMany({
    take: 5,
    select: { title: true, location: true, caseNo: true },
  });
  const users = await p.user.findMany({ select: { name: true, email: true } });
  const project = await p.project.findFirst();
  const out = JSON.stringify({ cases, users, project }, null, 2);
  console.log(out);
  // Show code points of first title
  if (cases[0]) {
    console.log(
      "title codepoints:",
      [...cases[0].title].map((ch) => ch.codePointAt(0)?.toString(16)).join(" ")
    );
  }
}

main()
  .finally(() => p.$disconnect());
