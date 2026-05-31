-- Per-workspace AI provider config (overrides ANTHROPIC_* env when set).
-- The API key is stored encrypted (AES-256-GCM, lib/crypto.ts).
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "aiApiKeyEnc" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "aiBaseUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "aiModel" TEXT;
