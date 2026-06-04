-- TaskAttachment: track which cloud provider hosts each attachment
ALTER TABLE "TaskAttachment" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'onedrive';

-- Per-user Google Drive connection (mirrors MicrosoftAccount)
CREATE TABLE "GoogleAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleUserId" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "refreshTokenEnc" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpiry" TIMESTAMP(3),
    "scope" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoogleAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleAccount_userId_key" ON "GoogleAccount"("userId");

ALTER TABLE "GoogleAccount" ADD CONSTRAINT "GoogleAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
