import { readFile } from "fs/promises";
import path from "path";
import { putStoredFile, hasObjectStore } from "../src/lib/storage";

const DEMO = [
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
  console.log("objectStore", hasObjectStore());
  const assetDir = path.join(process.cwd(), "prisma", "seed-assets", "evidence");
  for (const fileName of DEMO) {
    const bytes = await readFile(path.join(assetDir, fileName));
    await putStoredFile(`evidence/${fileName}`, bytes, "image/jpeg");
    console.log("ok", fileName, bytes.length);
  }
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
