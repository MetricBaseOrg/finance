-- Baseline migration: records Notification columns that were previously applied
-- to the database via `prisma db push` but never captured in migration history.
-- The columns already exist in every environment; this migration is marked as
-- applied (not executed) where that is the case. Safe to run on fresh databases.

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "actorId" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "taskId" TEXT;
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "commentId" TEXT;
