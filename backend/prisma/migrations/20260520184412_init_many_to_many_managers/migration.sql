/*
  Warnings:

  - You are about to drop the column `managerId` on the `Task` table. All the data in the column will be lost.
  - You are about to drop the `ModuleMember` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ModuleMember" DROP CONSTRAINT "ModuleMember_moduleId_fkey";

-- DropForeignKey
ALTER TABLE "ModuleMember" DROP CONSTRAINT "ModuleMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_managerId_fkey";

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "managerId",
ADD COLUMN     "clientRequestId" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "ModuleMember";

-- CreateTable
CREATE TABLE "_TaskManagers" (
    "A" TEXT NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_TaskManagers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TaskManagers_B_index" ON "_TaskManagers"("B");

-- AddForeignKey
ALTER TABLE "_TaskManagers" ADD CONSTRAINT "_TaskManagers_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskManagers" ADD CONSTRAINT "_TaskManagers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
