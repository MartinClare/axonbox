/**
 * Capture English UI screens for the Help manual.
 * Usage: npx playwright install chromium && node scripts/capture-help-screens.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = process.env.AXON_URL || "http://127.0.0.1:3000";
const OUT = path.join(process.cwd(), "public", "help-media");
const DOC = path.join(process.cwd(), "docs", "manual-screenshots");

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(DOC, { recursive: true });

async function shot(page, name) {
  const file = `${name}.png`;
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, file), fullPage: true });
  fs.copyFileSync(path.join(OUT, file), path.join(DOC, file));
  console.log("saved", file);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: "en-HK",
});
await context.addCookies([
  { name: "axonbox-ui-locale", value: "en", url: BASE },
]);
await context.addInitScript(() => {
  localStorage.setItem("axonbox:uiLocale", "en");
});

const page = await context.newPage();
page.setDefaultTimeout(20000);

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await shot(page, "fig-03-1-login");

await page.locator("form button").first().click();
await page.waitForURL(/\/$|\/\?/, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(800);
await shot(page, "fig-03-2-overview");
await shot(page, "fig-05-1-overview");
await shot(page, "fig-05-2-charts");
await shot(page, "fig-04-sidebar");

await page.goto(`${BASE}/install`, { waitUntil: "domcontentloaded" });
await shot(page, "fig-03-5-install");

await page.goto(`${BASE}/settings`, { waitUntil: "domcontentloaded" });
await shot(page, "fig-16-1-settings");
await shot(page, "fig-16-2-language");

await page.goto(`${BASE}/capture`, { waitUntil: "domcontentloaded" });
await shot(page, "fig-06-1-capture");
await shot(page, "fig-06-3-result");

await page.goto(`${BASE}/inbox`, { waitUntil: "domcontentloaded" });
await shot(page, "fig-07-1-inbox");
await shot(page, "fig-07-3-approve");

await page.goto(`${BASE}/cases`, { waitUntil: "domcontentloaded" });
await shot(page, "fig-08-1-list");

const caseLink = page.locator('a[href^="/cases/"]').first();
if (await caseLink.count()) {
  await caseLink.click();
  await page.waitForTimeout(600);
  await shot(page, "fig-08-2-detail");
  await shot(page, "fig-08-3-assign");
  const filesTab = page.getByRole("button", { name: /Files|附件/ });
  if (await filesTab.count()) {
    await filesTab.click();
    await page.waitForTimeout(300);
  }
  await shot(page, "fig-08-4-files");
  const detailsTab = page.getByRole("button", { name: /Details|詳情/ });
  if (await detailsTab.count()) await detailsTab.click();
  await page.waitForTimeout(300);
  await shot(page, "fig-08-5-close");
}

await page.goto(`${BASE}/tasks`, { waitUntil: "domcontentloaded" });
await shot(page, "fig-09-1-tasks");
await shot(page, "fig-09-3-minutes");

await page.goto(`${BASE}/checklist`, { waitUntil: "domcontentloaded" });
await shot(page, "fig-10-1-checklist");

await page.goto(`${BASE}/evidence`, { waitUntil: "domcontentloaded" });
await shot(page, "fig-11-1-evidence");
const ev = page.locator("img, [class*='grid'] button, a").nth(0);
await page.waitForTimeout(400);
await shot(page, "fig-11-3-detail");

await page.goto(`${BASE}/daily-reports`, { waitUntil: "domcontentloaded" });
await shot(page, "fig-12-1-diary");

await page.goto(`${BASE}/reports`, { waitUntil: "domcontentloaded" });
await shot(page, "fig-13-1-reports");

await page.goto(`${BASE}/knowledge`, { waitUntil: "domcontentloaded" });
await shot(page, "fig-14-1-knowledge");

await page.goto(`${BASE}/directory`, { waitUntil: "domcontentloaded" });
await shot(page, "fig-15-1-directory");

await browser.close();
console.log("done");
