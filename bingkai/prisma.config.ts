import { config as loadEnv } from "dotenv";
import path from "node:path";
import { defineConfig } from "prisma/config";

// .env.local first (Next.js convention), then .env.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

// Migrate needs a direct, unpooled connection: pgbouncer drops the advisory lock
// that `migrate deploy` depends on. Same reasoning as apps/platform.
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: { path: path.join("prisma", "migrations") },
  datasource: { url: migrationUrl },
});
