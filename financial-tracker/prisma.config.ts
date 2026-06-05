import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local first (Next.js convention), then fall back to .env
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

// Prefer an UNPOOLED / direct connection for the Prisma CLI (migrations).
// pgbouncer/pooled connections drop the long-running advisory lock that
// `prisma migrate deploy` uses for safety (results in P1002 timeout).
// Runtime queries from src/server/db.ts can still use the pooled DATABASE_URL.
const migrationUrl =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: migrationUrl,
  },
});
