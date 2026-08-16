/**
 * Upload construction-site demo photos to object storage / local uploads
 * and point PHOTO evidence with demo-* paths at them.
 *
 * Usage: npx tsx scripts/sync-demo-evidence-photos.ts
 */
import { readFile } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { putStoredFile } from "../src/lib/storage";

const prisma = new PrismaClient();

const DEMO_PHOTOS = [
  "demo-01-scaffold.jpg",
  "demo-02-rebar.jpg",
  "demo-03-opening.jpg",
  "demo-04-materials.jpg",
  "demo-05-facade.jpg",
  "demo-06-water.jpg",
  "demo-07-ppe.jpg",
  "demo-08-concrete.jpg",
  "demo-09-dust.jpg",
  "demo-10-steel.jpg",
  "demo-11-net.jpg",
  "demo-12-tiles.jpg",
  "demo-13-lighting.jpg",
  "demo-14-crane.jpg",
  "demo-15-waterproof.jpg",
  "demo-16-noise.jpg",
] as const;

async function main() {
  const assetDir = path.join(process.cwd(), "prisma", "seed-assets", "evidence");

  for (const fileName of DEMO_PHOTOS) {
    const bytes = await readFile(path.join(assetDir, fileName));
    const key = `evidence/${fileName}`;
    await putStoredFile(key, bytes, "image/jpeg");
    console.log("uploaded", key, bytes.length);
  }

  const demoEvidence = await prisma.evidence.findMany({
    where: {
      OR: [
        { filePath: { contains: "demo-" } },
        { type: "PHOTO", case: { caseNo: { startsWith: "C-2024-0610-" } } },
      ],
    },
    include: { case: { select: { caseNo: true } } },
    orderBy: { createdAt: "asc" },
  });

  let i = 0;
  for (const row of demoEvidence) {
    const fileName =
      DEMO_PHOTOS.find((name) => row.filePath?.includes(name)) ||
      DEMO_PHOTOS[i % DEMO_PHOTOS.length];
    i += 1;
    const filePath = `/uploads/evidence/${fileName}`;
    await prisma.evidence.update({
      where: { id: row.id },
      data: { filePath, mime: "image/jpeg", type: "PHOTO" },
    });
    console.log("linked", row.case?.caseNo || row.id, "->", fileName);
  }

  // Drop obvious non-site junk thumbs from email imports that look broken in the gallery
  const junk = await prisma.evidence.findMany({
    where: {
      OR: [
        { title: { contains: "image001" } },
        { filePath: { endsWith: ".gif" } },
      ],
      caseId: null,
    },
  });
  for (const row of junk) {
    await prisma.evidence.delete({ where: { id: row.id } });
    console.log("removed junk", row.title, row.filePath);
  }

  console.log("done");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
