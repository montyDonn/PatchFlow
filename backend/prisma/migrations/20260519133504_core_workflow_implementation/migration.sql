-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "clientId" UUID,
ADD COLUMN     "dateEnded" TIMESTAMP(3),
ADD COLUMN     "dateGiven" TIMESTAMP(3),
ADD COLUMN     "dateStarted" TIMESTAMP(3),
ADD COLUMN     "managerId" UUID;

-- CreateTable
CREATE TABLE "_TaskDevelopers" (
    "A" TEXT NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_TaskDevelopers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_TaskVerifiers" (
    "A" TEXT NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_TaskVerifiers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TaskDevelopers_B_index" ON "_TaskDevelopers"("B");

-- CreateIndex
CREATE INDEX "_TaskVerifiers_B_index" ON "_TaskVerifiers"("B");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskDevelopers" ADD CONSTRAINT "_TaskDevelopers_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskDevelopers" ADD CONSTRAINT "_TaskDevelopers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskVerifiers" ADD CONSTRAINT "_TaskVerifiers_A_fkey" FOREIGN KEY ("A") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TaskVerifiers" ADD CONSTRAINT "_TaskVerifiers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
