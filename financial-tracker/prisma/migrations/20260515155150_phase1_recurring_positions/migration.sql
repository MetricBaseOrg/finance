-- CreateEnum
CREATE TYPE "RecurrenceFreq" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "UnitKind" AS ENUM ('SHARES', 'TOKENS', 'LOTS');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "positionId" TEXT;

-- CreateTable
CREATE TABLE "RecurringRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "finAccountId" TEXT NOT NULL,
    "counterAccountId" TEXT,
    "categoryId" TEXT,
    "type" "TxnType" NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "memo" TEXT,
    "freq" "RecurrenceFreq" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "nextRunDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "lastPostedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "finAccountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "unitKind" "UnitKind" NOT NULL DEFAULT 'SHARES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lot" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "side" "TradeSide" NOT NULL,
    "quantity" DECIMAL(20,8) NOT NULL,
    "unitCost" DECIMAL(20,8) NOT NULL,
    "fee" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "remainingQty" DECIMAL(20,8) NOT NULL,
    "acquiredDate" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringRule_workspaceId_nextRunDate_idx" ON "RecurringRule"("workspaceId", "nextRunDate");

-- CreateIndex
CREATE INDEX "RecurringRule_workspaceId_idx" ON "RecurringRule"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Position_finAccountId_symbol_key" ON "Position"("finAccountId", "symbol");

-- CreateIndex
CREATE INDEX "Position_workspaceId_idx" ON "Position"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Lot_transactionId_key" ON "Lot"("transactionId");

-- CreateIndex
CREATE INDEX "Lot_positionId_idx" ON "Lot"("positionId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_finAccountId_fkey" FOREIGN KEY ("finAccountId") REFERENCES "FinAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_counterAccountId_fkey" FOREIGN KEY ("counterAccountId") REFERENCES "FinAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_finAccountId_fkey" FOREIGN KEY ("finAccountId") REFERENCES "FinAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lot" ADD CONSTRAINT "Lot_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
