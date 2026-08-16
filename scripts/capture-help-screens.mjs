/**
 * Capture English UI screens for the Help manual.
 * Usage: AXON_URL=https://axonbox-production.up.railway.app node scripts/capture-help-screens.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = process.env.AXON_URL || "https://axonbox-production.up.railway.app";
const EMAIL = process.env.AXON_EMAIL || "admin@axon.demo";
const PASSWORD = process.env.AXON_PASSWORD || "demo1234";
const OUT = path.join(process.cwd(), "public", "help-media");
const DOC = path.join(process.cwd(), "docs", "manual-screenshots");

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(DOC, { recursive: true });

async function hideChrome(page) {
  await page.addStyleTag({
    content: `
      [data-help-hide="ask"],
      button.fixed[aria-label*="Ask"],
      button.fixed[aria-label*="engineering"] {
        display: none !important;
      }
    `,
  }).catch(() => {});
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("button")) {
      const label = `${el.getAttribute("aria-label") || ""} ${el.textContent || ""}`;
      if (/ask/i.test(label) && /fixed/.test(el.className)) {
        el.style.display = "none";
      }
    }
  }).catch(() => {});
}

async function shot(page, name, locator) {
  await hideChrome(page);
  await page.waitForTimeout(250);
  const file = `${name}.png`;
  const dest = path.join(OUT, file);
  if (locator) {
    await locator.screenshot({ path: dest });
  } else {
    await page.screenshot({ path: dest, fullPage: false, animations: "disabled" });
  }
  fs.copyFileSync(dest, path.join(DOC, file));
  console.log("saved", file);
}

async function ready(page, pathOrUrl, waitFor) {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : `${BASE}${pathOrUrl}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (waitFor) {
    await page.locator(waitFor).first().waitFor({ timeout: 20000 });
  }
  await page.waitForTimeout(500);
  await hideChrome(page);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: "en-HK",
  deviceScaleFactor: 1,
});
await context.addCookies([{ name: "axonbox-ui-locale", value: "en", url: BASE }]);
await context.addInitScript(() => {
  localStorage.setItem("axonbox:uiLocale", "en");
  localStorage.setItem("axon-theme", "light");
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "light";
  document.documentElement.dataset.theme = "light";
});

const page = await context.newPage();
page.setDefaultTimeout(25000);

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" }).catch(() =>
  page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" }),
);
await page.waitForSelector("form", { timeout: 20000 });
await page.waitForTimeout(600);
await shot(page, "fig-03-1-login");

await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(PASSWORD);
await page.locator("form button").first().click();
await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 25000 });
await page.getByRole("heading", { name: /overview/i }).waitFor({ timeout: 20000 });
await page.waitForTimeout(800);
await hideChrome(page);

await shot(page, "fig-03-2-overview");
await shot(page, "fig-05-1-overview");

const charts = page.getByText("By category", { exact: false }).first();
if (await charts.count()) {
  await charts.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
}
await shot(page, "fig-05-2-charts");

const sidebar = page.locator('[data-help="sidebar"], aside').first();
await shot(page, "fig-04-sidebar", sidebar);

await ready(page, "/install", "text=Install");
await shot(page, "fig-03-5-install");

await ready(page, "/settings", "text=Interface language");
await page.getByText(/appearance/i).first().waitFor({ timeout: 15000 }).catch(() => {});
await shot(page, "fig-16-2-language");
const project = page.getByText(/project name|site code|project/i).first();
if (await project.count()) await project.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
await shot(page, "fig-16-1-settings");

await ready(page, "/capture", "text=Capture the site");
await shot(page, "fig-06-1-capture");

try {
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 960;
    c.height = 640;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#6b7280";
    ctx.fillRect(0, 0, 960, 640);
    ctx.fillStyle = "#b45309";
    ctx.fillRect(80, 220, 800, 40);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "32px sans-serif";
    ctx.fillText("Scaffold guardrail gap — L3 west", 90, 180);
    return c.toDataURL("image/jpeg", 0.85);
  });
  const buf = Buffer.from(dataUrl.split(",")[1], "base64");
  const tmp = path.join(process.cwd(), "tmp-help-capture.jpg");
  fs.writeFileSync(tmp, buf);
  await page.locator('input[type="file"]').first().setInputFiles(tmp);
  await page.waitForTimeout(400);
  const findBtn = page.getByRole("button", { name: /find issues/i });
  if (await findBtn.isEnabled()) {
    await findBtn.click();
    await page.getByText(/severity|confidence|create case|save to evidence|save evidence/i).first().waitFor({
      timeout: 55000,
    });
    await page.waitForTimeout(500);
    await shot(page, "fig-06-3-result");
  } else {
    await shot(page, "fig-06-3-result");
  }
  fs.unlinkSync(tmp);
} catch (err) {
  console.warn("AI result shot fallback:", err.message);
  await shot(page, "fig-06-3-result");
}

await ready(page, "/inbox", "text=Inbox");
await shot(page, "fig-07-1-inbox");
for (const name of [/pending approval/i, /task created/i, /dismissed/i]) {
  const tab = page.getByRole("button", { name });
  if (await tab.count()) {
    await tab.click().catch(() => {});
    await page.waitForTimeout(400);
  }
  const row = page.locator("text=Inbox list").locator("xpath=..").locator("button, a, [class*=cursor]").nth(1);
  if (await row.count()) {
    await row.click().catch(() => {});
    await page.waitForTimeout(500);
    if (await page.getByRole("button", { name: /approve/i }).count()) break;
  }
}
await shot(page, "fig-07-3-approve");

await ready(page, "/cases", "text=Cases");
await page.waitForTimeout(400);
await shot(page, "fig-08-1-list");

const caseLink = page.locator('a[href^="/cases/"]').first();
if (await caseLink.count()) {
  await caseLink.click();
  await page.getByRole("button", { name: /^edit$/i }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(500);
  await shot(page, "fig-08-2-detail");

  const assign = page.getByText(/step 2|send \/ assign|subcontractor/i).first();
  if (await assign.count()) await assign.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await shot(page, "fig-08-3-assign");

  const filesTab = page.getByRole("button", { name: /files/i });
  if (await filesTab.count()) {
    await filesTab.click();
    await page.waitForTimeout(500);
  }
  await shot(page, "fig-08-4-files");

  const detailsTab = page.getByRole("button", { name: /details/i });
  if (await detailsTab.count()) await detailsTab.click();
  await page.waitForTimeout(300);
  const closeBtn = page.getByText(/verify & close|close-out pack|loop complete/i).first();
  if (await closeBtn.count()) await closeBtn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await shot(page, "fig-08-5-close");
}

await ready(page, "/tasks", "text=Tasks");
await shot(page, "fig-09-1-tasks");
const minutesBar = page.getByText(/meeting minutes/i).first();
if (await minutesBar.count()) {
  await minutesBar.scrollIntoViewIfNeeded();
  const header = page.locator("header, .axon-page-header, h1").first();
  await shot(page, "fig-09-3-minutes");
} else {
  await shot(page, "fig-09-3-minutes");
}

await ready(page, "/checklist", "text=Checklist");
await page.waitForTimeout(400);
const template = page.locator("button, a").filter({ hasText: /.+/ }).nth(0);
await shot(page, "fig-10-1-checklist");

await ready(page, "/evidence", "text=Evidence");
await page.waitForTimeout(1000);
await shot(page, "fig-11-1-evidence");

// Open fullscreen lightbox so the action bar (Create/Open Case, Replace, Delete) is visible
const thumb = page.locator("main button.group, main button.aspect-square").first();
if (await thumb.count()) {
  await thumb.click();
} else {
  const anyThumb = page.locator("main img").first();
  if (await anyThumb.count()) await anyThumb.click();
}
await page
  .getByRole("dialog")
  .or(page.getByText(/create case|open case|replace photo|link to case/i).first())
  .waitFor({ timeout: 15000 })
  .catch(() => {});
await page.waitForTimeout(800);
await shot(page, "fig-11-3-detail");
// Close lightbox if open so later navigations are clean
await page.keyboard.press("Escape").catch(() => {});
await page.waitForTimeout(300);

await ready(page, "/daily-reports", "text=Daily");
await page.waitForTimeout(500);
await shot(page, "fig-12-1-diary");

await ready(page, "/reports", "text=Reports");
await page.waitForTimeout(400);
await shot(page, "fig-13-1-reports");

await ready(page, "/knowledge", "text=Ask");
await page.waitForTimeout(400);
await shot(page, "fig-14-1-knowledge");

await ready(page, "/directory", "text=People");
await page.waitForTimeout(400);
await shot(page, "fig-15-1-directory");

await browser.close();
console.log("done");
