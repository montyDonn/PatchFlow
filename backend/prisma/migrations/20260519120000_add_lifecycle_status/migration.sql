-- Add lifecycleStatus column to Task for active/custom/soft delete states
ALTER TABLE "Task"
ADD COLUMN "lifecycleStatus" INTEGER NOT NULL DEFAULT 0;
