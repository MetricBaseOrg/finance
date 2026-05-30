import { prisma } from '@/lib/prisma'
import type { AgentTool, ToolContext } from '@/lib/agent/types'

// Field (oil & gas) read tools. Dates are stored as ISO 'YYYY-MM-DD' strings to
// stay compatible with the Python compute engine, so range filters are string
// comparisons (lexicographic order matches chronological for ISO dates).

const fieldSummary: AgentTool = {
  scope: 'field',
  definition: {
    name: 'get_field_summary',
    description: 'Production summary for the field: total flow volume by flow type over a date range, plus node and lifting counts.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: "ISO date 'YYYY-MM-DD' (inclusive)." },
        to: { type: 'string', description: "ISO date 'YYYY-MM-DD' (inclusive)." },
      },
    },
  },
  async execute(ctx: ToolContext, input: { from?: string; to?: string }) {
    const dateFilter =
      input.from || input.to
        ? { date: { ...(input.from && { gte: input.from }), ...(input.to && { lte: input.to }) } }
        : {}
    const flows = await prisma.flow.groupBy({
      by: ['flowType'],
      where: { organizationId: ctx.organizationId, ...dateFilter },
      _sum: { volume: true },
    })
    const [nodeCount, liftingCount] = await Promise.all([
      prisma.node.count({ where: { organizationId: ctx.organizationId, active: true } }),
      prisma.lifting.count({ where: { organizationId: ctx.organizationId } }),
    ])
    return {
      from: input.from ?? null,
      to: input.to ?? null,
      volumeByFlowType: flows.map(f => ({ flowType: f.flowType, volume: Number(f._sum.volume ?? 0) })),
      activeNodes: nodeCount,
      liftings: liftingCount,
    }
  },
}

const listNodes: AgentTool = {
  scope: 'field',
  definition: {
    name: 'list_field_nodes',
    description: 'List the field nodes (wells, tanks, etc.) with code, name, type, and capacity.',
    input_schema: { type: 'object', properties: {} },
  },
  async execute(ctx: ToolContext) {
    const nodes = await prisma.node.findMany({
      where: { organizationId: ctx.organizationId, active: true },
      select: { code: true, name: true, nodeType: true, capacity: true, unit: true },
      orderBy: { code: 'asc' },
    })
    return { nodes }
  },
}

const productionVsTarget: AgentTool = {
  scope: 'field',
  definition: {
    name: 'get_production_vs_target',
    description: 'Compare actual production volume against targets for a given year/month, per node.',
    input_schema: {
      type: 'object',
      properties: {
        year: { type: 'number' },
        month: { type: 'number', description: '1-12.' },
      },
      required: ['year', 'month'],
    },
  },
  async execute(ctx: ToolContext, input: { year: number; month: number }) {
    const mm = String(input.month).padStart(2, '0')
    const prefix = `${input.year}-${mm}` // matches ISO 'YYYY-MM-...'
    const [targets, flows, nodes] = await Promise.all([
      prisma.target.findMany({
        where: { organizationId: ctx.organizationId, year: input.year, month: input.month },
        select: { nodeId: true, targetVol: true, category: true },
      }),
      prisma.flow.findMany({
        where: { organizationId: ctx.organizationId, date: { startsWith: prefix }, status: 'actual' },
        select: { nodeId: true, volume: true },
      }),
      prisma.node.findMany({
        where: { organizationId: ctx.organizationId },
        select: { id: true, code: true, name: true },
      }),
    ])
    const node = new Map(nodes.map(n => [n.id, n]))
    const actualByNode = new Map<string, number>()
    for (const f of flows) actualByNode.set(f.nodeId, (actualByNode.get(f.nodeId) ?? 0) + f.volume)

    return {
      period: `${input.year}-${mm}`,
      rows: targets.map(t => {
        const actual = actualByNode.get(t.nodeId) ?? 0
        const target = t.targetVol ?? 0
        return {
          node: node.get(t.nodeId)?.code ?? t.nodeId,
          category: t.category,
          target,
          actual,
          variance: actual - target,
          pctOfTarget: target ? Math.round((actual / target) * 100) : null,
        }
      }),
    }
  },
}

export const fieldTools: AgentTool[] = [fieldSummary, listNodes, productionVsTarget]
