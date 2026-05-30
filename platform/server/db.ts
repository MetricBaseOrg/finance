// Finance module compatibility shim: ported finance code imports `db` from
// here. The platform has a single Prisma client in lib/prisma.ts.
export { prisma as db } from '@/lib/prisma'
