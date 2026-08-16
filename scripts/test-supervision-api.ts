/**
 * Authenticated API scenario tests against local next dev.
 * Run: npx tsx scripts/test-supervision-api.ts
 */
const BASE = process.env.TEST_BASE || "http://127.0.0.1:3000";
const EMAIL = process.env.TEST_EMAIL || "admin@axon.demo";
const PASSWORD = process.env.TEST_PASSWORD || "demo1234";

let passed = 0;
let failed = 0;
const jar = new Map<string, string>();

function assert(cond: unknown, name: string, detail?: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

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
  // fallback for older undici
  const single = res.headers.get("set-cookie");
  if (single && raw.length === 0) {
    for (const part of single.split(/,(?=\s*[^;]+=)/)) {
      const [pair] = part.trim().split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }
}

async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  const c = cookieHeader();
  if (c) headers.set("cookie", c);
  if (init.body && !headers.has("content-type") && typeof init.body === "string") {
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

async function login() {
  console.log("\n[Auth] credentials login");
  const csrfRes = await api("/api/auth/csrf");
  const csrf =
    csrfRes.data && typeof csrfRes.data === "object" && csrfRes.data !== null
      ? String((csrfRes.data as { csrfToken?: string }).csrfToken || "")
      : "";
  assert(Boolean(csrf), "got csrf token");

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
  const email =
    session.data && typeof session.data === "object" && session.data !== null
      ? (session.data as { user?: { email?: string } }).user?.email
      : undefined;
  assert(email === EMAIL, `session user ${email}`);
}

async function closeGateScenarios() {
  console.log("\n[P0 API] close gate scenarios");
  const create = await api("/api/cases", {
    method: "POST",
    body: JSON.stringify({
      title: `API close test ${Date.now()}`,
      description: "scenario",
      category: "QUALITY",
      severity: "LOW",
      location: "Test bay",
      createTask: false,
    }),
  });
  assert(create.res.status === 201 || create.res.status === 200, `create case ${create.res.status}`);
  const caseId =
    create.data && typeof create.data === "object"
      ? String((create.data as { id?: string }).id || "")
      : "";
  assert(Boolean(caseId), "case id");

  // link discovery evidence
  const projectCases = await api(`/api/cases/${caseId}`);
  assert(projectCases.res.status === 200, "get case");

  // close without after → 400
  const blocked = await api(`/api/cases/${caseId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "CLOSED",
      eventType: "CLOSE",
      eventNote: "should fail",
    }),
  });
  assert(blocked.res.status === 400, `close without after → 400 (got ${blocked.res.status})`);
  assert(
    blocked.data &&
      typeof blocked.data === "object" &&
      (blocked.data as { error?: string }).error === "CLOSE_EVIDENCE_REQUIRED",
    "error CLOSE_EVIDENCE_REQUIRED",
  );

  // waive without note → 400
  const waiveEmpty = await api(`/api/cases/${caseId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "CLOSED",
      waiveCloseEvidence: true,
      eventNote: "   ",
    }),
  });
  assert(waiveEmpty.res.status === 400, `waive empty note → 400 (got ${waiveEmpty.res.status})`);

  // separate case: waive with note succeeds
  const create2 = await api("/api/cases", {
    method: "POST",
    body: JSON.stringify({
      title: `API waive test ${Date.now()}`,
      description: "waive scenario",
      category: "OTHER",
      severity: "LOW",
      location: "Test",
    }),
  });
  const caseId2 =
    create2.data && typeof create2.data === "object"
      ? String((create2.data as { id?: string }).id || "")
      : "";
  const waived = await api(`/api/cases/${caseId2}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "CLOSED",
      waiveCloseEvidence: true,
      eventNote: "現場已修復，無法補拍",
    }),
  });
  assert(waived.res.status === 200, `waive with note → 200 (got ${waived.res.status})`);
  const waivedDetail = await api(`/api/cases/${caseId2}`);
  const events =
    waivedDetail.data && typeof waivedDetail.data === "object"
      ? ((waivedDetail.data as { events?: Array<{ type: string }> }).events || [])
      : [];
  assert(
    events.some((e) => e.type === "CLOSE_WAIVE"),
    "CLOSE_WAIVE event logged",
  );

  // create evidence via multipart minimal chat
  const form = new FormData();
  form.append("title", "整改後照片");
  form.append("chatText", "after fix photo placeholder");
  form.append("skipAi", "1");
  form.append("tagsJson", JSON.stringify(["整改後"]));
  const evRes = await fetch(`${BASE}/api/evidence`, {
    method: "POST",
    headers: { cookie: cookieHeader() },
    body: form,
  });
  storeCookies(evRes);
  const evText = await evRes.text();
  let ev: { id?: string; error?: string } = {};
  try {
    ev = evText ? JSON.parse(evText) : {};
  } catch {
    ev = {};
  }
  assert(
    evRes.status === 201 && Boolean(ev.id),
    `create evidence with after tag (${evRes.status}: ${evText.slice(0, 120)})`,
  );
  if (!ev.id) return;

  // attach to case
  const attach = await api(`/api/evidence/${ev.id}`, {
    method: "PATCH",
    body: JSON.stringify({ caseId, markAfter: true }),
  });
  assert(attach.res.status === 200, `attach+markAfter ${attach.res.status}`);

  // assign then close
  await api(`/api/cases/${caseId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "ASSIGNED", eventType: "ASSIGN", eventNote: "指派" }),
  });
  const closed = await api(`/api/cases/${caseId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "CLOSED",
      eventType: "CLOSE",
      eventNote: "核驗通過",
    }),
  });
  assert(closed.res.status === 200, `close with after → 200 (got ${closed.res.status})`);
  assert(
    closed.data &&
      typeof closed.data === "object" &&
      (closed.data as { status?: string }).status === "CLOSED",
    "status CLOSED",
  );

  const pack = await api(`/api/cases/${caseId}/pack`);
  assert(pack.res.status === 200, `pack ${pack.res.status}`);
  const filePath =
    pack.data && typeof pack.data === "object"
      ? String((pack.data as { filePath?: string }).filePath || "")
      : "";
  assert(filePath.includes(".pdf"), `pack filePath ${filePath}`);

  // cleanup soft: leave closed case (demo data ok) or delete via prisma not available here
}

async function diaryAndInspect() {
  console.log("\n[P1/P2 API] diary + inspect");
  const today = new Date().toISOString().slice(0, 10);
  const diary = await api(`/api/site-diary?date=${today}`);
  assert(diary.res.status === 200, `site-diary ${diary.res.status}`);
  assert(
    diary.data &&
      typeof diary.data === "object" &&
      typeof (diary.data as { shareText?: string }).shareText === "string",
    "diary shareText present",
  );

  const list = await api("/api/checklist");
  assert(list.res.status === 200, `checklist list ${list.res.status}`);
  const templates =
    list.data && typeof list.data === "object"
      ? ((list.data as { templates?: Array<{ id: string }> }).templates || [])
      : [];
  assert(templates.length > 0, "has checklist templates");

  const start = await api("/api/checklist", {
    method: "POST",
    body: JSON.stringify({ action: "start", templateId: templates[0].id }),
  });
  assert(start.res.status === 200, `start inspect ${start.res.status}`);
  const runId =
    start.data && typeof start.data === "object"
      ? String((start.data as { id?: string }).id || "")
      : "";

  const fail = await api("/api/checklist", {
    method: "POST",
    body: JSON.stringify({
      action: "inspectResult",
      id: runId,
      result: "FAIL",
      items: [{ id: "1", text: "護欄", checked: false }],
      note: "API fail scenario",
    }),
  });
  assert(fail.res.status === 200, `inspect FAIL ${fail.res.status}`);
  const failCase =
    fail.data && typeof fail.data === "object"
      ? (fail.data as { case?: { id?: string; caseNo?: string } | null }).case
      : null;
  assert(Boolean(failCase?.id), `FAIL created case ${failCase?.caseNo}`);

  const start2 = await api("/api/checklist", {
    method: "POST",
    body: JSON.stringify({ action: "start", templateId: templates[0].id }),
  });
  const runId2 =
    start2.data && typeof start2.data === "object"
      ? String((start2.data as { id?: string }).id || "")
      : "";
  const pass = await api("/api/checklist", {
    method: "POST",
    body: JSON.stringify({
      action: "inspectResult",
      id: runId2,
      result: "PASS",
      items: [{ id: "1", text: "ok", checked: true }],
    }),
  });
  assert(pass.res.status === 200, `inspect PASS ${pass.res.status}`);
  const evidence =
    pass.data && typeof pass.data === "object"
      ? (pass.data as { evidence?: { id?: string } | null }).evidence
      : null;
  assert(Boolean(evidence?.id), "PASS created evidence");
}

async function ownerSmoke() {
  console.log("\n[P3 API] overview page loads");
  const home = await api("/");
  assert(home.res.status === 200 || home.res.status === 307 || home.res.status === 302, `home ${home.res.status}`);
  const overdue = await api("/cases?overdue=1");
  assert(
    overdue.res.status === 200 || overdue.res.status === 307 || overdue.res.status === 302,
    `cases overdue filter ${overdue.res.status}`,
  );
}

async function main() {
  console.log(`API tests → ${BASE} as ${EMAIL}`);
  await login();
  await closeGateScenarios();
  await diaryAndInspect();
  await ownerSmoke();
  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
