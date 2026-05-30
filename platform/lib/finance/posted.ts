/**
 * Spread into a Prisma `where` to count only POSTED transactions. PENDING
 * (awaiting OWNER/ADMIN approval) and REJECTED entries must never affect
 * balances, P&L, budgets, reports, or project rollups.
 *
 *   where: { ...POSTED_WHERE, organizationId, ... }
 */
export const POSTED_WHERE = { status: "POSTED" } as const;
