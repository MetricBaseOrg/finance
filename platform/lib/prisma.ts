import { PrismaClient } from '@/app/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const FILTERED_TXN_OPS = new Set(["findMany", "aggregate", "groupBy", "count"])

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
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
