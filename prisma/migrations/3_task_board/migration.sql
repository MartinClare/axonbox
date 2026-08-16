-- AlterTable
ALTER TABLE "Task" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Task" ADD COLUMN "labelsJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Task" ADD COLUMN "coverColor" TEXT;
ALTER TABLE "Task" ADD COLUMN "checklistJson" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Task" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Task_status_sortOrder_idx" ON "Task"("status", "sortOrder");
