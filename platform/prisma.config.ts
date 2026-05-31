import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

// Load .env.local first (Next.js convention), then fall back to .env.
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

// The Prisma CLI (migrate) needs a DIRECT/unpooled connection — pgbouncer
// drops the advisory lock that `migrate deploy` relies on (P1002 timeout).
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? ''

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: migrationUrl,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
})
