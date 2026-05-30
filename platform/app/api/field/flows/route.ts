import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFieldContext, FIELD_ENUMS } from '@/server/field'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const days = Math.min(Number(url.searchParams.get('days') ?? 90) || 90, 366)
  const flowType = url.searchParams.get('type') || undefined
  const nodeId = url.searchParams.get('nodeId') || undefined
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

  const flows = await prisma.flow.findMany({
    where: {
      organizationId: ctx.organizationId,
      date: { gte: since },
      ...(flowType ? { flowType } : {}),
      ...(nodeId ? { nodeId } : {}),
    },
    include: { node: { select: { code: true, name: true, nodeType: true } } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 1000,
  })
  return NextResponse.json(flows)
}

export async function POST(req: NextRequest) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const nodeId = String(body.nodeId ?? '')
  const date = String(body.date ?? '').slice(0, 10)
  const flowType = String(body.flowType ?? '').trim().toLowerCase()
  const volume = Number(body.volume)

  if (!nodeId || !date) return NextResponse.json({ error: 'nodeId and date are required' }, { status: 400 })
  if (!FIELD_ENUMS.FLOW_TYPES.includes(flowType)) {
    return NextResponse.json({ error: `flowType must be one of ${FIELD_ENUMS.FLOW_TYPES.join(', ')}` }, { status: 400 })
  }
  if (!Number.isFinite(volume)) return NextResponse.json({ error: 'volume must be a number' }, { status: 400 })

  // Verify node belongs to the org.
  const node = await prisma.node.findFirst({ where: { id: nodeId, organizationId: ctx.organizationId } })
  if (!node) return NextResponse.json({ error: 'Unknown node' }, { status: 400 })

  const status = FIELD_ENUMS.FLOW_STATUS.includes(body.status) ? body.status : 'actual'
  const flow = await prisma.flow.create({
    data: {
      organizationId: ctx.organizationId,
      nodeId,
      date,
      flowType,
      volume,
      swPct: body.swPct != null ? Number(body.swPct) : null,
      category: body.category ? String(body.category) : null,
      status,
      memo: body.memo ? String(body.memo) : null,
      reportedBy: body.reportedBy ? String(body.reportedBy) : null,
    },
  })
  return NextResponse.json(flow, { status: 201 })
}
