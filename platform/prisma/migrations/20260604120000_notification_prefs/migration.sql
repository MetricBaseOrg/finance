-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email_notifications" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN     "daily_digest" BOOLEAN NOT NULL DEFAULT true;
