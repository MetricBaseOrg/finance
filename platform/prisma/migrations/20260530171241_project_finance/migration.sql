-- AlterEnum
ALTER TYPE "FinAccountType" ADD VALUE 'PROJECT';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "budget" DECIMAL(20,4);
