-- AlterTable
ALTER TABLE "TaskComment" ADD COLUMN     "authorName" TEXT,
ADD COLUMN     "authorRole" TEXT,
ADD COLUMN     "files" JSONB;
