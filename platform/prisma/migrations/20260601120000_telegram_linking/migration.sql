-- AlterTable
ALTER TABLE "User" ADD COLUMN     "telegram_active_org_id" TEXT,
ADD COLUMN     "telegram_linked_at" TIMESTAMP(3),
ADD COLUMN     "telegram_user_id" BIGINT,
ADD COLUMN     "telegram_username" TEXT;

-- CreateTable
CREATE TABLE "telegram_link_tokens" (
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_link_tokens_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE INDEX "telegram_link_tokens_userId_idx" ON "telegram_link_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegram_user_id_key" ON "User"("telegram_user_id");

-- AddForeignKey
ALTER TABLE "telegram_link_tokens" ADD CONSTRAINT "telegram_link_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
