import { prisma } from '@/lib/prisma'
import { POSTED_WHERE } from '@/lib/finance/posted'
import type { AgentTool, ToolContext } from '@/lib/agent/types'

// All amounts use the transaction's baseAmount (already converted to the org's
// base currency). Read-only — agents never mutate finance data in this phase.

const financeSummary: AgentTool = {
  scope: 'finance',
  definition: {
    name: 'get_finance_summary',
    description: 'Income, expense, and net for the workspace over a date range (base currency). Optionally grouped by category.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'ISO start date (inclusive). Defaults to start of the current month.' },
        to: { type: 'string', description: 'ISO end date (inclusive). Defaults to now.' },
        byCategory: { type: 'boolean', description: 'Also break expenses down by category.' },
      },
    },
  },
  async execute(ctx: ToolContext, input: { from?: string; to?: string; byCategory?: boolean }) {
    const now = new Date()
    const from = input.from ? new Date(input.from) : new Date(now.getFullYear(), now.getMonth(), 1)
    const to = input.to ? new Date(input.to) : now
    const where = { ...POSTED_WHERE, organizationId: ctx.organizationId, date: { gte: from, lte: to } }

    const grouped = await prisma.transaction.groupBy({
      by: ['type'],
      where,
      _sum: { baseAmount: true },
    })
    const sumFor = (t: string) => Number(grouped.find(g => g.type === t)?._sum.baseAmount ?? 0)
    const income = sumFor('INCOME')
    const expense = sumFor('EXPENSE')

    const result: Record<string, unknown> = {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      income,
      expense,
      net: income - expense,
    }

    if (input.byCategory) {
      const byCat = await prisma.transaction.groupBy({
        by: ['categoryId'],
        where: { ...where, type: 'EXPENSE' },
        _sum: { baseAmount: true },
      })
      const cats = await prisma.category.findMany({
        where: { organizationId: ctx.organizationId },
        select: { id: true, name: true },
      })
      const nameById = new Map(cats.map(c => [c.id, c.name]))
      result.expenseByCategory = byCat
        .map(b => ({ category: b.categoryId ? nameById.get(b.categoryId) ?? 'Unknown' : 'Uncategorized', amount: Number(b._sum.baseAmount ?? 0) }))
        .sort((a, b) => b.amount - a.amount)
    }

    return result
  },
}

const queryTransactions: AgentTool = {
  scope: 'finance',
  definition: {
    name: 'query_transactions',
    description: 'List recent transactions in the workspace, optionally filtered by type or date range.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'INCOME, EXPENSE, or TRANSFER.' },
        from: { type: 'string', description: 'ISO start date.' },
        to: { type: 'string', description: 'ISO end date.' },
        limit: { type: 'number', description: 'Max rows (default 25, max 100).' },
      },
    },
  },
  async execute(ctx: ToolContext, input: { type?: string; from?: string; to?: string; limit?: number }) {
    const where: Record<string, unknown> = { organizationId: ctx.organizationId }
    if (input.type) where.type = input.type
    if (input.from || input.to) {
      where.date = {
        ...(input.from && { gte: new Date(input.from) }),
        ...(input.to && { lte: new Date(input.to) }),
      }
    }
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100)
    const txns = await prisma.transaction.findMany({
      where,
      select: {
        date: true, type: true, baseAmount: true, currency: true, amount: true, memo: true,
        category: { select: { name: true } },
        finAccount: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
    })
    return {
      count: txns.length,
      transactions: txns.map(t => ({
        date: t.date.toISOString().slice(0, 10),
        type: t.type,
        baseAmount: Number(t.baseAmount),
        amount: Number(t.amount),
        currency: t.currency,
        account: t.finAccount.name,
        category: t.category?.name ?? null,
        memo: t.memo,
      })),
    }
  },
}

export const financeTools: AgentTool[] = [financeSummary, queryTransactions]
