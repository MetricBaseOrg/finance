import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// pg v9 / pg-connection-string v3 will change the meaning of sslmode
// require/prefer/verify-ca. Today they're aliases for verify-full; pin that
// explicitly so behaviour is unchanged and the deprecation warning is silenced.
function pinSslMode(url?: string): string | undefined {
  if (!url) return url
  return url.replace(/([?&]sslmode=)(require|prefer|verify-ca)\b/i, '$1verify-full')
}

// Transaction reads that compute totals/lists must exclude non-POSTED entries
// (PENDING awaiting approval, REJECTED). Centralised here via a client extension
// so every aggregation is covered without scattering filters across the app.
//   - Applies to: findMany, aggregate, groupBy, count
//   - Skipped when the caller already specifies `status` (ledger, pending queue)
//   - NOT applied to findFirst/findUnique (approve/edit must see PENDING)
const FILTERED_TXN_OPS = new Set(["findMany", "aggregate", "groupBy", "count"])

function createPrismaClient() {
  const url = pinSslMode(process.env.DIRECT_URL || process.env.DATABASE_URL)
  const adapter = new PrismaPg({ connectionString: url })
  return new PrismaClient({ adapter }).$extends({
    query: {
      transaction: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ operation, args, query }: any) {
          if (FILTERED_TXN_OPS.has(operation)) {
            args.where = args.where ?? {}
            if (!("status" in args.where)) args.where.status = "POSTED"
          }
          return query(args)
        },
      },
    },
  })
}

type ExtendedPrisma = ReturnType<typeof createPrismaClient>
const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrisma }

export const prisma: ExtendedPrisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
