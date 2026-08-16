-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingAt" TIMESTAMP(3),
    "sourceName" TEXT,
    "rawText" TEXT,
    "projectId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "caseId" DROP NOT NULL;
ALTER TABLE "Task" ADD COLUMN "meetingId" TEXT;

-- CreateIndex
CREATE INDEX "Meeting_projectId_sortOrder_idx" ON "Meeting"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "Task_meetingId_sortOrder_idx" ON "Task"("meetingId", "sortOrder");

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
