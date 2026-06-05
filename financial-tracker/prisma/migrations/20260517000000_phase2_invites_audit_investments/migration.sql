-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'ARCHIVE', 'UNARCHIVE', 'INVITE_CREATE', 'INVITE_REVOKE', 'INVITE_ACCEPT', 'MEMBER_ROLE_CHANGE', 'MEMBER_REMOVE', 'INVESTMENT_BUY', 'INVESTMENT_SELL', 'INVESTMENT_DIVIDEND');

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('ACCOUNT', 'TRANSACTION', 'CATEGORY', 'WORKSPACE', 'FX_RATE', 'MEMBERSHIP', 'INVITE', 'INVESTMENT_POSITION', 'INVESTMENT_LOT', 'DIVIDEND');

-- CreateTable
CREATE TABLE "WorkspaceInvite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "email" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentPosition" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "finAccountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT NOT NULL,
    "lastPrice" DECIMAL(20,8),
    "lastPriceAt" TIMESTAMP(3),
    "realizedPl" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentLot" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "quantity" DECIMAL(20,4) NOT NULL,
    "remainingQuantity" DECIMAL(20,4) NOT NULL,
    "costPerUnit" DECIMAL(20,8) NOT NULL,
    "fees" DECIMAL(20,4),
    "acquiredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dividend" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "totalAmount" DECIMAL(20,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "payDate" TIMESTAMP(3) NOT NULL,
    "transactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dividend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceInvite_token_key" ON "WorkspaceInvite"("token");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_workspaceId_idx" ON "WorkspaceInvite"("workspaceId");

-- CreateIndex
CREATE INDEX "WorkspaceInvite_email_idx" ON "WorkspaceInvite"("email");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_action_idx" ON "AuditLog"("workspaceId", "action");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_entityType_idx" ON "AuditLog"("workspaceId", "entityType");

-- CreateIndex
CREATE INDEX "InvestmentPosition_workspaceId_idx" ON "InvestmentPosition"("workspaceId");

-- CreateIndex
CREATE INDEX "InvestmentPosition_finAccountId_idx" ON "InvestmentPosition"("finAccountId");

-- CreateIndex
CREATE INDEX "InvestmentLot_positionId_acquiredAt_idx" ON "InvestmentLot"("positionId", "acquiredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Dividend_transactionId_key" ON "Dividend"("transactionId");

-- CreateIndex
CREATE INDEX "Dividend_positionId_payDate_idx" ON "Dividend"("positionId", "payDate");

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentPosition" ADD CONSTRAINT "InvestmentPosition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentPosition" ADD CONSTRAINT "InvestmentPosition_finAccountId_fkey" FOREIGN KEY ("finAccountId") REFERENCES "FinAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentLot" ADD CONSTRAINT "InvestmentLot_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "InvestmentPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "InvestmentPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dividend" ADD CONSTRAINT "Dividend_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
