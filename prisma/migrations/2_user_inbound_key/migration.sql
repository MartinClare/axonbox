-- AlterTable
ALTER TABLE "User" ADD COLUMN "inboundKey" TEXT;
CREATE UNIQUE INDEX "User_inboundKey_key" ON "User"("inboundKey");

-- AlterTable
ALTER TABLE "InboxMessage" ADD COLUMN "forwardedByUserId" TEXT;
ALTER TABLE "InboxMessage" ADD CONSTRAINT "InboxMessage_forwardedByUserId_fkey" FOREIGN KEY ("forwardedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
