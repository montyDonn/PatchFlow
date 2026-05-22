-- AlterTable
ALTER TABLE "StatusHistory" ADD COLUMN     "changedByName" TEXT,
ADD COLUMN     "changedByRole" TEXT,
ADD COLUMN     "changedByUsername" TEXT;

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;
