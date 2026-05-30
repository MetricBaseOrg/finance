import 'server-only'
import { prisma } from '@/lib/prisma'
import { POSTED_WHERE } from '@/lib/finance/posted'

/**
 * Per-project finance rollups, in the organization's base currency (baseAmount).
 * Income/expense are summed from transactions attributed to the project (either
 * via a PROJECT account or a per-transaction tag).
 */
export type ProjectFinance = {
  income: number
  expense: number
  net: number
  txnCount: number
}

function emptyFinance(): ProjectFinance {
  return { income: 0, expense: 0, net: 0, txnCount: 0 }
}

/** Rollup for every project that has attributed transactions, keyed by projectId. */
export async function projectFinanceMap(organizationId: string): Promise<Map<string, ProjectFinance>> {
  const grouped = await prisma.transaction.groupBy({
    by: ['projectId', 'type'],
    where: { ...POSTED_WHERE, organizationId, projectId: { not: null } },
    _sum: { baseAmount: true },
    _count: { _all: true },
  })
  const map = new Map<string, ProjectFinance>()
  for (const g of grouped) {
    if (!g.projectId) continue
    const cur = map.get(g.projectId) ?? emptyFinance()
    const amt = Number(g._sum.baseAmount ?? 0)
    if (g.type === 'INCOME') cur.income += amt
    else if (g.type === 'EXPENSE') cur.expense += amt
    cur.txnCount += g._count._all
    cur.net = cur.income - cur.expense
    map.set(g.projectId, cur)
  }
  return map
}

/** Rollup for a single project. */
export async function projectFinance(organizationId: string, projectId: string): Promise<ProjectFinance> {
  const grouped = await prisma.transaction.groupBy({
    by: ['type'],
    where: { ...POSTED_WHERE, organizationId, projectId },
    _sum: { baseAmount: true },
    _count: { _all: true },
  })
  const f = emptyFinance()
  for (const g of grouped) {
    const amt = Number(g._sum.baseAmount ?? 0)
    if (g.type === 'INCOME') f.income += amt
    else if (g.type === 'EXPENSE') f.expense += amt
    f.txnCount += g._count._all
  }
  f.net = f.income - f.expense
  return f
}
