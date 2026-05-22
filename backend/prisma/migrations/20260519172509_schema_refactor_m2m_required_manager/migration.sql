/*
  Warnings:

  - You are about to drop the `UserModule` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `managerId` on table `Task` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_managerId_fkey";

-- DropForeignKey
ALTER TABLE "UserModule" DROP CONSTRAINT "UserModule_assignedBy_fkey";

-- DropForeignKey
ALTER TABLE "UserModule" DROP CONSTRAINT "UserModule_moduleId_fkey";

-- DropForeignKey
ALTER TABLE "UserModule" DROP CONSTRAINT "UserModule_userId_fkey";

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "managerId" SET NOT NULL;

-- DropTable
DROP TABLE "UserModule";

-- CreateTable
CREATE TABLE "_UserModules" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_UserModules_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_UserModules_B_index" ON "_UserModules"("B");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserModules" ADD CONSTRAINT "_UserModules_A_fkey" FOREIGN KEY ("A") REFERENCES "Module"("moduleId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_UserModules" ADD CONSTRAINT "_UserModules_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
