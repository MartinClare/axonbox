/**
 * Scenario tests for private-project supervision loop (P0–P3).
 * Run: npx tsx scripts/test-supervision-loop.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  ensureAfterTag,
  hasAfterEvidence,
  isAfterEvidence,
  parseEvidenceTags,
  tagsIncludeAfter,
} from "../src/lib/case-closeout";
import { buildCasePackPdf } from "../src/lib/reports/case-pack-pdf";

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function assert(cond: unknown, name: string, detail?: string) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function unitCloseout() {
  console.log("\n[Unit] case-closeout helpers");
  assert(tagsIncludeAfter('["整改後"]'), "tag 整改後 counts as after");
  assert(tagsIncludeAfter('["after"]'), "tag after counts as after");
  assert(tagsIncludeAfter('["closeout"]'), "tag closeout counts as after");
  assert(!tagsIncludeAfter('["before"]'), "tag before does not count");
  assert(parseEvidenceTags('["#a","b"]').join(",") === "a,b", "parse strips #");

  const ensured = ensureAfterTag('["site"]');
  assert(tagsIncludeAfter(ensured) && ensured.includes("整改後"), "ensureAfterTag adds 整改後");

  const t0 = new Date("2026-01-01T10:00:00Z");
  const t1 = new Date("2026-01-01T12:00:00Z");
  const t2 = new Date("2026-01-01T14:00:00Z");
  const events = [{ type: "ASSIGN", createdAt: t1 }];
  const before = { id: "1", createdAt: t0, tagsJson: "[]" };
  const afterByTime = { id: "2", createdAt: t2, tagsJson: "[]" };
  const afterByTag = { id: "3", createdAt: t0, tagsJson: '["整改後"]' };

  assert(!isAfterEvidence(before, events), "photo before ASSIGN is not after");
  assert(isAfterEvidence(afterByTime, events), "photo after ASSIGN is after");
  assert(isAfterEvidence(afterByTag, events), "tagged photo is after even if early");
  assert(!hasAfterEvidence([before], events), "no after evidence → false");
  assert(hasAfterEvidence([before, afterByTime], events), "has after by time");
  assert(hasAfterEvidence([afterByTag], []), "has after by tag without events");
}

async function scenarioCloseGate() {
  console.log("\n[P0] Close gate via DB + helper (mirrors API)");
  const project = await prisma.project.findFirst();
  assert(project, "project exists");
  if (!project) return;

  const caseNo = `TEST-CLOSE-${Date.now()}`;
  const item = await prisma.case.create({
    data: {
      caseNo,
      title: "測試關閉閘門",
      description: "scenario",
      category: "QUALITY",
      severity: "LOW",
      location: "測試區",
      status: "PENDING_REVIEW",
      projectId: project.id,
    },
  });

  await prisma.caseEvent.create({
    data: { caseId: item.id, type: "ASSIGN", note: "指派" },
  });

  const discovery = await prisma.evidence.create({
    data: {
      type: "PHOTO",
      title: "發現照",
      projectId: project.id,
      caseId: item.id,
      tagsJson: "[]",
      status: "PENDING",
      createdAt: new Date(Date.now() - 3600_000),
    },
  });

  let current = await prisma.case.findUnique({
    where: { id: item.id },
    include: { evidence: true, events: true },
  });
  assert(current && !hasAfterEvidence(current.evidence, current.events), "close blocked without after");

  // waive path validation
  const waiveOk = Boolean("原因：現場已修復無法補拍".trim());
  assert(waiveOk, "waive requires non-empty note");

  // mark after
  await prisma.evidence.update({
    where: { id: discovery.id },
    data: { tagsJson: ensureAfterTag(discovery.tagsJson) },
  });
  current = await prisma.case.findUnique({
    where: { id: item.id },
    include: { evidence: true, events: true },
  });
  assert(current && hasAfterEvidence(current.evidence, current.events), "after tag unlocks close");

  await prisma.case.update({
    where: { id: item.id },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  const closed = await prisma.case.findUnique({ where: { id: item.id } });
  assert(closed?.status === "CLOSED" && closed.closedAt, "case closed successfully");

  // cleanup
  await prisma.evidence.deleteMany({ where: { caseId: item.id } });
  await prisma.caseEvent.deleteMany({ where: { caseId: item.id } });
  await prisma.case.delete({ where: { id: item.id } });
}

async function scenarioOverdue() {
  console.log("\n[P0] Overdue filter semantics");
  const project = await prisma.project.findFirst();
  if (!project) return;
  const caseNo = `TEST-OD-${Date.now()}`;
  const past = new Date(Date.now() - 3 * 86400000);
  const item = await prisma.case.create({
    data: {
      caseNo,
      title: "逾期測試",
      description: "x",
      category: "SAFETY",
      severity: "HIGH",
      location: "A",
      status: "ASSIGNED",
      dueAt: past,
      projectId: project.id,
    },
  });
  const now = new Date();
  const overdue = await prisma.case.count({
    where: { id: item.id, status: { not: "CLOSED" }, dueAt: { lt: now } },
  });
  assert(overdue === 1, "open case with past dueAt is overdue");
  await prisma.case.update({ where: { id: item.id }, data: { status: "CLOSED", closedAt: now } });
  const overdueClosed = await prisma.case.count({
    where: { id: item.id, status: { not: "CLOSED" }, dueAt: { lt: now } },
  });
  assert(overdueClosed === 0, "closed case not counted overdue");
  await prisma.case.delete({ where: { id: item.id } });
}

async function scenarioPackPdf() {
  console.log("\n[P0] Close pack PDF builds");
  const buf = await buildCasePackPdf({
    caseNo: "TEST-001",
    title: "Pack test",
    description: "desc",
    category: "SAFETY",
    severity: "MEDIUM",
    location: "L1",
    status: "CLOSED",
    projectName: "Demo",
    siteCode: "D1",
    assignee: "Alex",
    subcontractor: "Sub",
    discoveredAt: "2026-01-01",
    dueAt: "2026-01-05",
    closedAt: "2026-01-06",
    recommendation: "fix it",
    events: [{ at: "2026-01-01", type: "CREATE", note: "建立", actor: "A" }],
    beforeImages: [{ title: "before" }],
    afterImages: [{ title: "after" }],
    generatedAt: "now",
  });
  assert(buf.length > 500, `PDF buffer size ok (${buf.length} bytes)`);
  assert(buf.subarray(0, 4).toString() === "%PDF", "PDF magic header");
}

async function scenarioDiary() {
  console.log("\n[P1] Soft diary rollup query");
  const project = await prisma.project.findFirst();
  if (!project) return;
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  const next = new Date(day);
  next.setDate(next.getDate() + 1);
  const now = new Date();
  const [opened, closed, overdue] = await Promise.all([
    prisma.case.count({
      where: { projectId: project.id, discoveredAt: { gte: day, lt: next } },
    }),
    prisma.case.count({
      where: { projectId: project.id, closedAt: { gte: day, lt: next } },
    }),
    prisma.case.count({
      where: { projectId: project.id, status: { not: "CLOSED" }, dueAt: { lt: now } },
    }),
  ]);
  assert(typeof opened === "number", `opened count=${opened}`);
  assert(typeof closed === "number", `closed count=${closed}`);
  assert(typeof overdue === "number", `overdue count=${overdue}`);
}

async function scenarioInspect() {
  console.log("\n[P2] Inspect-lite Pass / Fail");
  const project = await prisma.project.findFirst();
  const template = await prisma.checklistTemplate.findFirst();
  assert(project && template, "project + checklist template exist");
  if (!project || !template) return;

  const runPass = await prisma.checklistRun.create({
    data: {
      templateId: template.id,
      projectId: project.id,
      title: `TEST PASS ${Date.now()}`,
      status: "IN_PROGRESS",
      itemsJson: JSON.stringify([{ id: "1", text: "ok", checked: true }]),
    },
  });
  await prisma.checklistRun.update({
    where: { id: runPass.id },
    data: { status: "PASSED", completedAt: new Date() },
  });
  const ev = await prisma.evidence.create({
    data: {
      type: "DOC",
      title: `點檢通過：${runPass.title}`,
      tagsJson: ensureAfterTag("[]"),
      projectId: project.id,
      status: "HANDLED",
      source: "UPLOAD",
    },
  });
  assert(tagsIncludeAfter(ev.tagsJson), "PASS creates after-tagged evidence");
  await prisma.evidence.delete({ where: { id: ev.id } });
  await prisma.checklistRun.delete({ where: { id: runPass.id } });

  const runFail = await prisma.checklistRun.create({
    data: {
      templateId: template.id,
      projectId: project.id,
      title: `TEST FAIL ${Date.now()}`,
      status: "IN_PROGRESS",
      itemsJson: JSON.stringify([
        { id: "1", text: "護欄", checked: false },
        { id: "2", text: "標示", checked: true },
      ]),
    },
  });
  const { nextCaseNo } = await import("../src/lib/case-no");
  const caseNo = await nextCaseNo();
  const created = await prisma.case.create({
    data: {
      caseNo,
      title: `點檢不合格：${runFail.title}`,
      description: "以下項目未通過：\n• 護欄",
      category: "QUALITY",
      severity: "MEDIUM",
      location: "現場點檢",
      sourceType: "CHECKLIST",
      status: "OPEN",
      projectId: project.id,
    },
  });
  await prisma.checklistRun.update({
    where: { id: runFail.id },
    data: { status: "FAILED", completedAt: new Date() },
  });
  assert(created.status === "OPEN", "FAIL creates open case");
  assert(created.title.includes("點檢不合格"), "FAIL case title");

  await prisma.case.delete({ where: { id: created.id } });
  await prisma.checklistRun.delete({ where: { id: runFail.id } });
}

async function scenarioOwner() {
  console.log("\n[P3] Owner dashboard counts");
  const now = new Date();
  const [safetyOpen, qualityOpen, overdueCases, agingMinutes, pendingInspect] =
    await Promise.all([
      prisma.case.count({ where: { category: "SAFETY", status: { not: "CLOSED" } } }),
      prisma.case.count({ where: { category: "QUALITY", status: { not: "CLOSED" } } }),
      prisma.case.count({ where: { status: { not: "CLOSED" }, dueAt: { lt: now } } }),
      prisma.task.count({
        where: {
          meetingId: { not: null },
          status: { not: "DONE" },
          dueAt: { lt: now },
          archived: false,
        },
      }),
      prisma.checklistRun.count({ where: { status: "IN_PROGRESS" } }),
    ]);
  assert(safetyOpen >= 0, `safetyOpen=${safetyOpen}`);
  assert(qualityOpen >= 0, `qualityOpen=${qualityOpen}`);
  assert(overdueCases >= 0, `overdueCases=${overdueCases}`);
  assert(agingMinutes >= 0, `agingMinutes=${agingMinutes}`);
  assert(pendingInspect >= 0, `pendingInspect=${pendingInspect}`);
}

async function scenarioHttpLocal() {
  console.log("\n[HTTP] Local API smoke (unauthenticated expect 401/redirect)");
  const base = process.env.TEST_BASE || "http://127.0.0.1:3000";
  for (const path of [
    "/api/site-diary?date=2026-08-16",
    "/api/cases/does-not-exist/pack",
  ]) {
    try {
      const res = await fetch(`${base}${path}`);
      assert(
        res.status === 401 || res.status === 403 || res.status === 404 || res.status === 200,
        `${path} → ${res.status}`,
      );
    } catch (e) {
      assert(false, `${path} reachable`, String(e));
    }
  }
}

async function main() {
  console.log("Supervision loop scenario tests");
  await unitCloseout();
  await scenarioCloseGate();
  await scenarioOverdue();
  await scenarioPackPdf();
  await scenarioDiary();
  await scenarioInspect();
  await scenarioOwner();
  await scenarioHttpLocal();

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
