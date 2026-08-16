import { randomBytes } from "crypto";
import { readFile, copyFile, mkdir } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { putStoredFile, hasObjectStore } from "../src/lib/storage";

function generateInboundKey() {
  return randomBytes(16).toString("hex");
}

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

async function ensureDemoPhoto(fileName: string) {
  const key = `evidence/${fileName}`;
  const src = path.join(process.cwd(), "prisma", "seed-assets", "evidence", fileName);
  const bytes = await readFile(src);
  await putStoredFile(key, bytes, "image/jpeg");
  if (!hasObjectStore()) {
    const destDir = path.join(process.cwd(), "public", "uploads", "evidence");
    await mkdir(destDir, { recursive: true });
    await copyFile(src, path.join(destDir, fileName));
  }
  return `/uploads/${key}`;
}

// All Chinese via Unicode escapes so the seed file stays ASCII-safe on any OS/encoding.
const T = {
  admin: "\u5730\u76e4\u7d93\u7406 \u9673\u751f",
  supervisor: "\u73fe\u5834\u4e3b\u7ba1 \u674e\u751f",
  subUser: "\u5206\u5224\u8ca0\u8cac\u4eba \u738b\u751f",
  project: "AXON \u793a\u7bc4\u5730\u76e4 \u2014 \u4e5d\u9f8d\u7063\u5546\u696d\u7d9c\u5408\u9ad4",
  address: "\u4e5d\u9f8d\u7063\u81e8\u83ef\u8857",
  weather: "28\u00b0C \u6674",
  sub1: "ABC Safety Ltd.",
  sub1c: "\u5f35\u5148\u751f",
  sub2: "\u6c38\u76db\u92fc\u9435\u5de5\u7a0b",
  sub2c: "\u9ec3\u5de5",
  sub3: "\u5efa\u5b89\u6a21\u677f\u6709\u9650\u516c\u53f8",
  sub3c: "\u6797\u5de5",
  sub4: "\u6e05\u65b0\u74b0\u4fdd\u670d\u52d9",
  sub4c: "\u5468\u5c0f\u59d0",
  recommend: "\u8acb\u6309\u6307\u793a\u5b8c\u6210\u6574\u6539\u4e26\u4e0a\u50b3\u5b8c\u5de5\u7167\u7247\u6838\u9a57\u3002",
};

type Sample = {
  title: string;
  description: string;
  category: "SAFETY" | "QUALITY" | "PROGRESS" | "ENVIRONMENT" | "OTHER";
  severity: "HIGH" | "MEDIUM" | "LOW";
  location: string;
  status: "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "PENDING_REVIEW" | "CLOSED";
  days: number;
  dueIn?: number;
};

const samples: Sample[] = [
  {
    title: "B\u5340\u6a21\u677f\u4f5c\u696d\u7f3a\u5c11\u5b89\u5168\u570d\u6b04",
    description: "B\u53405\u6a13\u5e73\u53f0\u908a\u7de3\u672a\u8a2d\u7f6e\u5b89\u5168\u570d\u6b04\uff0c\u5b58\u5728\u589c\u843d\u98a8\u96aa\u3002",
    category: "SAFETY",
    severity: "HIGH",
    location: "B\u5340 - 5\u6a13\u5e73\u53f0",
    status: "IN_PROGRESS",
    days: 0,
    dueIn: 2,
  },
  {
    title: "A\u53403\u6a13\u92fc\u7b4b\u5916\u9732",
    description: "\u6df7\u51dd\u571f\u6f86\u7bc9\u5f8c\u5c40\u90e8\u92fc\u7b4b\u5916\u9732\uff0c\u9700\u88dc\u6f3f\u8655\u7406\u3002",
    category: "QUALITY",
    severity: "HIGH",
    location: "A\u5340 - 3\u6a13",
    status: "ASSIGNED",
    days: 1,
    dueIn: 3,
  },
  {
    title: "\u6d1e\u53e3\u672a\u5c01\u9589",
    description: "C\u53402\u6a13\u6a13\u677f\u6d1e\u53e3\u672a\u505a\u81e8\u6642\u5c01\u9589\uff0c\u5b89\u5168\u96b1\u60a3\u3002",
    category: "SAFETY",
    severity: "HIGH",
    location: "C\u5340 - 2\u6a13",
    status: "OPEN",
    days: 0,
    dueIn: 1,
  },
  {
    title: "\u6750\u6599\u5806\u653e\u963b\u7919\u901a\u9053",
    description: "B\u5340\u6750\u6599\u5806\u653e\u4f54\u7528\u6d88\u9632\u901a\u9053\u3002",
    category: "SAFETY",
    severity: "MEDIUM",
    location: "B\u5340 - \u5730\u9762\u5c64",
    status: "PENDING_REVIEW",
    days: 2,
    dueIn: 0,
  },
  {
    title: "\u5916\u7246\u9032\u5ea6\u843d\u5f8c",
    description: "\u5916\u7246\u6279\u76e7\u9032\u5ea6\u843d\u5f8c\u8a08\u5283\u7d043\u5929\u3002",
    category: "PROGRESS",
    severity: "MEDIUM",
    location: "\u4e3b\u6a13\u6771\u7acb\u9762",
    status: "IN_PROGRESS",
    days: 3,
    dueIn: 5,
  },
  {
    title: "\u6c61\u6c34\u6392\u653e\u672a\u9054\u6a19",
    description: "\u6c89\u6fb1\u6c60\u9644\u8fd1\u6709\u6c61\u6c34\u6ea2\u51fa\u8de1\u8c61\u3002",
    category: "ENVIRONMENT",
    severity: "MEDIUM",
    location: "\u5730\u76e4\u5f8c\u9580",
    status: "CLOSED",
    days: 6,
  },
  {
    title: "\u5b89\u5168\u5e3d\u4f69\u6234\u4e0d\u9f4a",
    description: "\u5de1\u67e5\u767c\u73fe2\u540d\u5de5\u4eba\u672a\u6b63\u78ba\u4f69\u6234\u5b89\u5168\u5e3d\u3002",
    category: "SAFETY",
    severity: "MEDIUM",
    location: "A\u5340\u540a\u904b\u5340",
    status: "CLOSED",
    days: 5,
  },
  {
    title: "\u6df7\u51dd\u571f\u8702\u7aa9\u9ebb\u9762",
    description: "\u67f1\u9762\u51fa\u73fe\u8702\u7aa9\uff0c\u9700\u947f\u9664\u4fee\u88dc\u3002",
    category: "QUALITY",
    severity: "MEDIUM",
    location: "A\u5340 - 1\u6a13\u67f1C12",
    status: "ASSIGNED",
    days: 2,
    dueIn: 4,
  },
  {
    title: "\u7c89\u5875\u9632\u63a7\u4e0d\u8db3",
    description: "\u5207\u5272\u4f5c\u696d\u672a\u555f\u52d5\u5674\u9727\u964d\u5875\u3002",
    category: "ENVIRONMENT",
    severity: "LOW",
    location: "\u6750\u6599\u52a0\u5de5\u5340",
    status: "OPEN",
    days: 1,
    dueIn: 2,
  },
  {
    title: "\u92fc\u7d50\u69cb\u9a57\u6536\u5b8c\u6210",
    description: "\u92fc\u6881\u5b89\u88dd\u5b8c\u6210\u4e26\u901a\u904e\u9a57\u6536\u3002",
    category: "PROGRESS",
    severity: "LOW",
    location: "\u5c4b\u9762\u92fc\u7d50\u69cb",
    status: "CLOSED",
    days: 4,
  },
  {
    title: "\u9632\u8b77\u7db2\u7834\u640d",
    description: "\u5916\u67b6\u9632\u8b77\u7db2\u5c40\u90e8\u7834\u640d\u9700\u66f4\u63db\u3002",
    category: "SAFETY",
    severity: "HIGH",
    location: "\u5916\u67b6\u6771\u5074",
    status: "IN_PROGRESS",
    days: 1,
    dueIn: 1,
  },
  {
    title: "\u74f7\u78da\u7a7a\u9f13\u62bd\u6aa2",
    description: "\u8d70\u5eca\u74f7\u78da\u62bd\u6aa2\u767c\u73fe\u7a7a\u9f13\u3002",
    category: "QUALITY",
    severity: "MEDIUM",
    location: "\u8fa6\u516c\u6a133\u6a13\u8d70\u5eca",
    status: "OPEN",
    days: 0,
    dueIn: 3,
  },
  {
    title: "\u591c\u9593\u7167\u660e\u4e0d\u8db3",
    description: "\u901a\u9053\u591c\u9593\u7167\u660e\u4e0d\u8db3\u5f71\u97ff\u5b89\u5168\u3002",
    category: "SAFETY",
    severity: "LOW",
    location: "\u81e8\u6642\u901a\u9053",
    status: "CLOSED",
    days: 8,
  },
  {
    title: "\u5854\u540a\u7dad\u4fdd\u8a18\u9304",
    description: "\u5854\u540a\u6708\u5ea6\u4fdd\u990a\u5b8c\u6210\u3002",
    category: "OTHER",
    severity: "LOW",
    location: "\u5854\u540a1\u865f",
    status: "CLOSED",
    days: 7,
  },
  {
    title: "\u9632\u6c34\u5c64\u6f0f\u505a",
    description: "\u6d17\u624b\u9593\u9632\u6c34\u5c64\u5c40\u90e8\u6f0f\u505a\u3002",
    category: "QUALITY",
    severity: "HIGH",
    location: "B\u53404\u6a13\u6d17\u624b\u9593",
    status: "ASSIGNED",
    days: 0,
    dueIn: 2,
  },
  {
    title: "\u56a8\u97f3\u8d85\u6a19\u6295\u8a34",
    description: "\u9130\u8fd1\u55ae\u4f4d\u53cd\u6620\u5348\u4f11\u6642\u6bb5\u56a8\u97f3\u3002",
    category: "ENVIRONMENT",
    severity: "MEDIUM",
    location: "\u5730\u76e4\u5357\u754c",
    status: "IN_PROGRESS",
    days: 2,
    dueIn: 1,
  },
];

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0 && process.env.FORCE_SEED !== "1") {
    console.log("SEED_SKIPPED");
    return;
  }

  await prisma.reportExport.deleteMany();
  await prisma.dailyReport.deleteMany();
  await prisma.inboxMessage.deleteMany();
  await prisma.caseEvent.deleteMany();
  await prisma.task.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.case.deleteMany();
  await prisma.subcontractor.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const admin = await prisma.user.create({
    data: {
      name: T.admin,
      email: "admin@axon.demo",
      passwordHash,
      role: "OWNER",
      phone: "9123 0001",
      title: "\u5730\u76e4\u7d93\u7406",
      company: "AXON Main Contractor",
      inboundKey: generateInboundKey(),
    },
  });
  const supervisor = await prisma.user.create({
    data: {
      name: T.supervisor,
      email: "supervisor@axon.demo",
      passwordHash,
      role: "SUPERVISOR",
      phone: "9123 0002",
      title: "\u73fe\u5834\u4e3b\u7ba1",
      company: "AXON Main Contractor",
      inboundKey: generateInboundKey(),
    },
  });
  const subUser = await prisma.user.create({
    data: {
      name: T.subUser,
      email: "sub@axon.demo",
      passwordHash,
      role: "SUBCONTRACTOR",
      phone: "9123 0003",
      title: "\u5206\u5224\u8ca0\u8cac\u4eba",
      company: T.sub1,
      inboundKey: generateInboundKey(),
    },
  });

  const project = await prisma.project.create({
    data: {
      name: T.project,
      siteCode: "KB-2024-A",
      address: T.address,
      weather: T.weather,
    },
  });

  const subs = await Promise.all([
    prisma.subcontractor.create({
      data: {
        name: T.sub1,
        contact: T.sub1c,
        phone: "2123 1001",
        email: "ops@abcsafety.demo",
        trade: "\u5b89\u5168\u9632\u8b77",
        licenseNo: "CIC-SAF-001",
        address: "\u89c0\u5858\u5de5\u696d\u5340",
        projectId: project.id,
        userId: subUser.id,
      },
    }),
    prisma.subcontractor.create({
      data: {
        name: T.sub2,
        contact: T.sub2c,
        phone: "2123 1002",
        email: "steel@wingshing.demo",
        trade: "\u92fc\u7b4b",
        licenseNo: "CIC-STL-014",
        projectId: project.id,
      },
    }),
    prisma.subcontractor.create({
      data: {
        name: T.sub3,
        contact: T.sub3c,
        phone: "2123 1003",
        email: "form@kinon.demo",
        trade: "\u6a21\u677f",
        licenseNo: "CIC-FRM-008",
        projectId: project.id,
      },
    }),
    prisma.subcontractor.create({
      data: {
        name: T.sub4,
        contact: T.sub4c,
        phone: "2123 1004",
        email: "clean@fresh.demo",
        trade: "\u74b0\u4fdd\u6e05\u6f54",
        licenseNo: "EP-CLN-22",
        projectId: project.id,
      },
    }),
  ]);

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const caseNo = `C-2024-0610-${String(i + 1).padStart(3, "0")}`;
    const discoveredAt = daysAgo(s.days);
    const closedAt = s.status === "CLOSED" ? daysAgo(Math.max(0, s.days - 1)) : null;
    const c = await prisma.case.create({
      data: {
        caseNo,
        title: s.title,
        description: s.description,
        category: s.category,
        severity: s.severity,
        location: s.location,
        status: s.status,
        recommendation: T.recommend,
        discoveredAt,
        dueAt: s.dueIn !== undefined ? daysFromNow(s.dueIn) : undefined,
        closedAt: closedAt || undefined,
        projectId: project.id,
        assigneeId: supervisor.id,
        subcontractorId: subs[i % subs.length].id,
        sourceType: "PHOTO",
      },
    });

    await prisma.caseEvent.createMany({
      data: [
        { caseId: c.id, type: "CREATE", note: "\u7531\u73fe\u5834\u7167\u7247\u5efa\u7acb Case", actorId: supervisor.id, createdAt: discoveredAt },
        ...(s.status !== "OPEN"
          ? [{ caseId: c.id, type: "ASSIGN", note: `\u5df2\u6307\u6d3e ${subs[i % subs.length].name}`, actorId: admin.id, createdAt: daysAgo(Math.max(0, s.days - 0.2)) }]
          : []),
        ...(s.status === "IN_PROGRESS" || s.status === "PENDING_REVIEW" || s.status === "CLOSED"
          ? [{ caseId: c.id, type: "PROGRESS", note: "\u5206\u5224\u5546\u958b\u59cb\u6574\u6539", actorId: subUser.id, createdAt: daysAgo(Math.max(0, s.days - 0.5)) }]
          : []),
        ...(s.status === "CLOSED"
          ? [{ caseId: c.id, type: "CLOSE", note: "\u6838\u9a57\u901a\u904e\uff0cCase \u95dc\u9589", actorId: supervisor.id, createdAt: closedAt! }]
          : []),
      ],
    });

    const taskStatus =
      s.status === "CLOSED"
        ? "DONE"
        : s.status === "PENDING_REVIEW"
          ? "PENDING_REVIEW"
          : s.status === "IN_PROGRESS" || s.status === "ASSIGNED"
            ? "IN_PROGRESS"
            : "PENDING";

    await prisma.task.create({
      data: {
        title: `\u6574\u6539\uff1a${s.title}`,
        instructions: s.description,
        status: taskStatus,
        dueAt: s.dueIn !== undefined ? daysFromNow(s.dueIn) : undefined,
        caseId: c.id,
        assigneeId: s.status === "OPEN" ? supervisor.id : subUser.id,
      },
    });

    const photoName = DEMO_PHOTOS[i % DEMO_PHOTOS.length];
    const filePath = await ensureDemoPhoto(photoName);

    await prisma.evidence.create({
      data: {
        type: "PHOTO",
        title: s.title,
        location: s.location,
        filePath,
        mime: "image/jpeg",
        status: s.status === "CLOSED" ? "HANDLED" : s.status === "OPEN" ? "PENDING" : "IN_PROGRESS",
        source: i % 3 === 0 ? "WHATSAPP_IMPORT" : i % 3 === 1 ? "UPLOAD" : "FOLDER",
        category: s.category,
        severity: s.severity,
        capturedAt: discoveredAt,
        caseId: c.id,
        projectId: project.id,
        aiJson: JSON.stringify({
          category: s.category,
          severity: s.severity,
          description: s.description,
          recommendation: "\u7acb\u5373\u8ddf\u9032\u6574\u6539",
        }),
      },
    });
  }

  await prisma.evidence.create({
    data: {
      type: "CHAT",
      title: "WhatsApp\uff1a\u4eca\u65e5\u92fc\u7b4b\u6aa2\u67e5\u5b8c\u6210",
      chatText: "\u73fe\u5834\u4e3b\u7ba1\uff1a\u4eca\u65e5\u92fc\u679d\u6aa2\u67e5\u5df2\u5b8c\u6210\uff0c\u8acb\u8ddf\u9032\u5b89\u5168\u570d\u6b04\u5b89\u88dd\u3002",
      status: "HANDLED",
      source: "WHATSAPP_IMPORT",
      category: "PROGRESS",
      projectId: project.id,
      capturedAt: daysAgo(0),
    },
  });

  await prisma.inboxMessage.createMany({
    data: [
      {
        channel: "EMAIL",
        sender: "safety@maincon.demo",
        subject: "B\u5340\u4e94\u6a13\u570d\u6b04\u672a\u88dd\u2014\u8acb\u7acb\u5373\u8655\u7406",
        body: "\u5de1\u67e5\u767c\u73fe B\u5340 5\u6a13\u5e73\u53f0\u908a\u7de3\u7f3a\u5c11\u5b89\u5168\u570d\u6b04\uff0c\u6d1e\u53e3\u4ea6\u672a\u5c01\u9589\u3002\u8acb\u4eca\u65e5\u5167\u5b89\u6392\u5206\u5224\u88dc\u8a2d\u4e26\u56de\u50b3\u7167\u7247\u3002",
        status: "PENDING",
        projectId: project.id,
        receivedAt: daysAgo(0),
      },
      {
        channel: "WHATSAPP",
        sender: "\u73fe\u5834\u4e3b\u7ba1",
        subject: null,
        body: "[10:21] \u73fe\u5834\u4e3b\u7ba1\uff1aA\u5340\u92fc\u7b4b\u5916\u9732\uff0c\u8acb\u6c38\u76db\u4eca\u65e5\u88dc\u6f3f",
        status: "PENDING",
        projectId: project.id,
        receivedAt: daysAgo(0),
      },
      {
        channel: "WECHAT",
        sender: "\u5f35\u5de5",
        subject: null,
        body: "\u5f35\u5de5\uff1aC\u5340\u6d1e\u53e3\u672a\u5c01\uff0c\u6709\u589c\u843d\u98a8\u96aa\uff0c\u8acb\u5b89\u6392\u4efb\u52d9",
        status: "PENDING",
        projectId: project.id,
        receivedAt: daysAgo(1),
      },
    ],
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.dailyReport.create({
    data: {
      projectId: project.id,
      date: today,
      weather: T.weather,
      workerCount: 128,
      subcontractorCount: 7,
      equipmentCount: 12,
      materialDeliveries: 4,
      progressPct: 68,
      safetyEvents: 2,
      reporterName: T.admin,
      status: "DRAFT",
      activitiesJson: JSON.stringify([
        { time: "08:00 - 09:30", name: "A\u53405\u6a13\u92fc\u7b4b\u7d81\u7d0a", status: "\u5b8c\u6210" },
        { time: "09:30 - 12:00", name: "B\u5340\u6a21\u677f\u5b89\u88dd", status: "\u9032\u884c\u4e2d" },
        { time: "13:00 - 17:00", name: "\u5916\u7246\u6279\u76e7", status: "\u9032\u884c\u4e2d" },
      ]),
      tomorrowPlanJson: JSON.stringify([
        "\u5b8c\u6210 B\u53405\u6a13\u5b89\u5168\u570d\u6b04\u5b89\u88dd",
        "A\u53403\u6a13\u92fc\u7b4b\u5916\u9732\u88dc\u6f3f",
        "\u5854\u540a\u6708\u5ea6\u9ede\u6aa2",
      ]),
      issuesJson: JSON.stringify([
        {
          id: "C-2024-0610-001",
          issue: samples[0].title,
          risk: "HIGH",
          assignee: T.sub1,
          deadline: daysFromNow(2).toISOString(),
          status: "IN_PROGRESS",
        },
        {
          id: "C-2024-0610-003",
          issue: samples[2].title,
          risk: "HIGH",
          assignee: T.sub3,
          deadline: daysFromNow(1).toISOString(),
          status: "OPEN",
        },
      ]),
      photoPathsJson: "[]",
    },
  });

  await prisma.orgSettings.deleteMany();
  await prisma.orgSettings.create({
    data: {
      name: "AxonBox Enterprise Demo",
      plan: "ENTERPRISE",
      allowSubInvite: true,
      requireApproval: true,
    },
  });

  await prisma.checklistRun.deleteMany();
  await prisma.checklistTemplate.deleteMany();
  await prisma.checklistTemplate.createMany({
    data: [
      {
        name: "\u65e5\u5e38\u5b89\u5168\u9ede\u6aa2",
        category: "SAFETY",
        description: "\u73fe\u5834\u6bcf\u65e5\u5b89\u5168\u5de1\u6aa2\uff08\u570d\u6b04\u3001PPE\u3001\u901a\u9053\uff09",
        sourceRef: "AxonBox site practice + HyD safety awareness",
        itemsJson: JSON.stringify([
          { id: "s1", text: "\u4f5c\u696d\u5340\u570d\u6b04\uff0f\u570d\u677f\u5b8c\u6574", required: true },
          { id: "s2", text: "\u6d1e\u53e3\uff0f\u908a\u7de3\u5df2\u5c01\u9589\u6216\u8b77\u7c95", required: true },
          { id: "s3", text: "\u4eba\u54e1 PPE \u7b26\u5408\u8981\u6c42", required: true },
          { id: "s4", text: "\u6d88\u9632\uff0f\u7dca\u6025\u901a\u9053\u66ab\u7121\u963b\u7919", required: true },
          { id: "s5", text: "\u5371\u96aa\u5df2\u8a18\u9304\u4e26\u901a\u77e5\u4e3b\u7ba1", required: false },
        ]),
      },
      {
        name: "\u9053\u8def\u958b\u6398\uff0fXPMS \u5408\u898f\u9ede\u6aa2",
        category: "XPMS",
        description: "\u5c0d\u7167\u8def\u653f\u7f72 XPMS\uff0fXPPM\uff1a\u8a31\u53ef\u3001AN\u3001\u5354\u8abf",
        sourceRef: "XPPM / https://xpms.hyd.gov.hk",
        itemsJson: JSON.stringify([
          { id: "x1", text: "\u5df2\u5728 XPMS \u5efa\u7acb plan\uff0f\u53d6\u5f97\u6709\u6548 XP\uff08\u5982\u9069\u7528\uff09", required: true },
          { id: "x2", text: "\u958b\u5de5\u524d 2 \u500b\u5de5\u4f5c\u5929\u5df2\u63d0\u4ea4 Advance Notification", required: true },
          { id: "x3", text: "\u6316\u6398\u7bc4\u570d\u8207\u8a31\u53ef\u9802\u9ede\u4e00\u81f4\uff08\u9ede\uff0f\u7dda\uff0f\u9762\uff09", required: true },
          { id: "x4", text: "\u81e8\u6642\u4ea4\u901a\u7ba1\u7406\uff0f\u7c64\u8a8c\u8b77\u885b\u5df2\u6309\u6279\u6838\u5be6\u65bd", required: true },
          { id: "x5", text: "\u82e5\u5ef6\u671f\u958b\u5de5\uff0c\u5df2\u53d6\u6d88\u8207\u91cd\u63d0 AN", required: false },
          { id: "x6", text: "\u885d\u7a81\u5de5\u7a0b\u5354\u8abf\uff0f\u9032\u5ea6\u8868\u5df2\u66f4\u65b0", required: false },
        ]),
      },
      {
        name: "\u9a57\u6536\uff0f\u5b8c\u5de5\u9ede\u6aa2",
        category: "ACCEPTANCE",
        description: "\u968e\u6bb5\uff0f\u5b8c\u5de5\u9a57\u6536\u524d\u6587\u4ef6\u8207\u73fe\u5834\u72c0\u6cc1",
        sourceRef: "AxonBox acceptance pack",
        itemsJson: JSON.stringify([
          { id: "a1", text: "\u6240\u6709\u9ad8\u98a8\u96aa\u4e8b\u4ef6\u5df2\u95dc\u9589\u4e26\u9644\u8b49\u64da\u7167", required: true },
          { id: "a2", text: "\u6574\u6539\u5b8c\u6210\u7167\u8207\u539f\u59cb\u7167\u53ef\u5c0d\u7167", required: true },
          { id: "a3", text: "Checklist \u8207\u65e5\u5831\uff0f\u9031\u5831\u5df2\u532f\u6574", required: true },
          { id: "a4", text: "\u5206\u5224\u5546\u7c3d\u8a8d\uff0f\u4ea4\u63a5\u8a18\u9304\u5b8c\u6574", required: false },
        ]),
      },
    ],
  });

  console.log("SEED_OK");
  console.log("SAMPLE_TITLE", samples[0].title);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
