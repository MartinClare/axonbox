/**
 * End-to-end real case walkthrough against local AxonBox.
 * Creates a realistic safety finding, runs assign → block → after proof → close → pack.
 */
import { writeFileSync } from "fs";
import { join } from "path";

const BASE = process.env.TEST_BASE || "http://127.0.0.1:3000";
const EMAIL = "admin@axon.demo";
const PASSWORD = "demo1234";
const jar = new Map<string, string>();

function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(res: Response) {
  const raw = res.headers.getSetCookie?.() || [];
  for (const line of raw) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
}

async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  const c = cookieHeader();
  if (c) headers.set("cookie", c);
  if (init.body && typeof init.body === "string" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: "manual" });
  storeCookies(res);
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data, text };
}

function step(title: string) {
  console.log(`\n▶ ${title}`);
}

function tinyPng(label: string): Buffer {
  // Minimal valid 1x1 PNG
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  void label;
  return Buffer.from(b64, "base64");
}

async function login() {
  step("Login as site admin");
  const csrfRes = await api("/api/auth/csrf");
  const csrf = String((csrfRes.data as { csrfToken?: string })?.csrfToken || "");
  const body = new URLSearchParams({
    csrfToken: csrf,
    email: EMAIL,
    password: PASSWORD,
    callbackUrl: `${BASE}/`,
    json: "true",
  });
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(),
    },
    body,
    redirect: "manual",
  });
  storeCookies(loginRes);
  const session = await api("/api/auth/session");
  const user = (session.data as { user?: { name?: string; email?: string } })?.user;
  console.log(`  logged in: ${user?.name} <${user?.email}>`);
}

async function uploadPhoto(title: string, tags: string[], chatHint: string) {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(tinyPng(title))], { type: "image/png" });
  form.append("file", blob, `${title.replace(/\s+/g, "-")}.png`);
  form.append("title", title);
  form.append("skipAi", "1");
  form.append("tagsJson", JSON.stringify(tags));
  form.append("chatText", chatHint);
  const res = await fetch(`${BASE}/api/evidence`, {
    method: "POST",
    headers: { cookie: cookieHeader() },
    body: form,
  });
  storeCookies(res);
  const data = (await res.json()) as { id?: string; error?: string };
  if (!res.ok || !data.id) throw new Error(`upload failed ${res.status}: ${JSON.stringify(data)}`);
  return data.id;
}

async function main() {
  console.log("=== Real case walkthrough ===");
  console.log(`Base: ${BASE}`);
  await login();

  const stamp = new Date().toLocaleString("zh-HK");
  const title = `外牆棚架護欄缺口 — 現場巡查 ${stamp}`;

  step("1) Create real safety case");
  const created = await api("/api/cases", {
    method: "POST",
    body: JSON.stringify({
      title,
      description:
        "巡查發現 Block B 外牆棚架 L3 向西面護欄缺一段約 1.2m，工人可直接踏出。已即時口頭要求分判暫停該區作業，並豎立臨時圍欄。需補回護欄並提交整改後照片核驗。",
      category: "SAFETY",
      severity: "HIGH",
      location: "Block B · 外牆棚架 L3 西面",
      recommendation: "24 小時內補回護欄；整改後拍照上傳；未通過前不得恢復高空作業。",
      createTask: true,
      dueAt: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    }),
  });
  if (created.res.status !== 201) {
    throw new Error(`create failed: ${created.text}`);
  }
  const c = created.data as { id: string; caseNo: string; status: string };
  console.log(`  caseNo=${c.caseNo} id=${c.id} status=${c.status}`);
  console.log(`  open: ${BASE}/cases/${c.id}`);

  step("2) Attach discovery (before) photo");
  const beforeId = await uploadPhoto(
    "發現時：護欄缺口",
    ["before", "棚架"],
    "巡查當下拍攝，可見缺口",
  );
  await api(`/api/evidence/${beforeId}`, {
    method: "PATCH",
    body: JSON.stringify({ caseId: c.id }),
  });
  console.log(`  before evidence=${beforeId}`);

  step("3) Assign to supervisor for remediation");
  const settings = await api("/api/settings");
  const users = ((settings.data as { users?: Array<{ id: string; name: string }> })?.users || []);
  const assignee = users.find((u) => /supervisor|監工|Alex|admin/i.test(u.name + u.id)) || users[0];
  const assign = await api(`/api/cases/${c.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "ASSIGNED",
      eventType: "ASSIGN",
      eventNote: `已指派整改：補回護欄並回報（${assignee?.name || "負責人"}）`,
      assigneeId: assignee?.id || null,
      dueAt: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      instructions: "補回護欄後上傳整改後照片，提交核驗。",
    }),
  });
  console.log(`  assign → ${assign.res.status} assignee=${assignee?.name}`);

  step("4) Mark in progress + submit for review");
  await api(`/api/cases/${c.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "IN_PROGRESS", eventType: "PROGRESS", eventNote: "分判開始補欄" }),
  });
  await api(`/api/cases/${c.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "PENDING_REVIEW", eventType: "REVIEW", eventNote: "分判聲稱已完成，提交核驗" }),
  });
  console.log("  status → PENDING_REVIEW");

  step("5) Attempt close WITHOUT after proof (expect fail)");
  const blocked = await api(`/api/cases/${c.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "CLOSED",
      eventType: "CLOSE",
      eventNote: "should be blocked",
    }),
  });
  console.log(
    `  → ${blocked.res.status} ${(blocked.data as { error?: string; message?: string })?.error || ""}`,
  );
  if (blocked.res.status !== 400) throw new Error("expected close to be blocked");

  step("6) Upload 整改後 photo and mark after");
  const afterId = await uploadPhoto(
    "整改後：護欄已補回",
    ["整改後"],
    "補欄完成，同一位置複拍",
  );
  await api(`/api/evidence/${afterId}`, {
    method: "PATCH",
    body: JSON.stringify({ caseId: c.id, markAfter: true }),
  });
  console.log(`  after evidence=${afterId}`);

  step("7) Close with after proof");
  const closed = await api(`/api/cases/${c.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "CLOSED",
      eventType: "CLOSE",
      eventNote: "核驗通過：護欄已補回，高空作業可恢復",
    }),
  });
  const closedBody = closed.data as { status?: string; closedAt?: string };
  console.log(`  → ${closed.res.status} status=${closedBody.status} closedAt=${closedBody.closedAt}`);
  if (closed.res.status !== 200 || closedBody.status !== "CLOSED") {
    throw new Error(`close failed: ${closed.text}`);
  }

  step("8) Generate 結案摘要 PDF");
  const pack = await api(`/api/cases/${c.id}/pack`);
  const filePath = (pack.data as { filePath?: string })?.filePath || "";
  console.log(`  → ${pack.res.status} ${filePath}`);
  if (pack.res.status !== 200 || !filePath.includes(".pdf")) throw new Error("pack failed");

  const pdfRes = await fetch(`${BASE}${filePath}`, { headers: { cookie: cookieHeader() } });
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  const out = join(process.cwd(), "tmp-real-case-pack.pdf");
  writeFileSync(out, pdfBuf);
  console.log(`  saved ${out} (${pdfBuf.length} bytes, magic=${pdfBuf.subarray(0, 4).toString()})`);

  step("9) Verify final case state");
  const final = await api(`/api/cases/${c.id}`);
  const detail = final.data as {
    caseNo: string;
    title: string;
    status: string;
    evidence: Array<{ id: string; title: string; tagsJson?: string }>;
    events: Array<{ type: string; note: string | null }>;
  };
  console.log(`  ${detail.caseNo} · ${detail.status}`);
  console.log(`  evidence (${detail.evidence.length}):`);
  for (const e of detail.evidence) {
    console.log(`    - ${e.title} tags=${e.tagsJson || "[]"}`);
  }
  console.log(`  timeline:`);
  for (const e of detail.events) {
    console.log(`    - ${e.type}: ${e.note || ""}`);
  }

  console.log("\n=== DONE ===");
  console.log(`View case: ${BASE}/cases/${c.id}`);
  console.log(`PDF pack:  ${BASE}${filePath}`);
  console.log(`Local PDF: ${out}`);
}

main().catch((e) => {
  console.error("\nFAILED:", e);
  process.exit(1);
});
