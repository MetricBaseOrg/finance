-- AlterTable: allow link attachments (no OneDrive item)
ALTER TABLE "TaskAttachment" ALTER COLUMN "msItemId" DROP NOT NULL;
