import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFieldContext } from '@/server/field'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const days = Math.min(Number(url.searchParams.get('days') ?? 90) || 90, 366)
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

  const transfers = await prisma.transfer.findMany({
    where: { organizationId: ctx.organizationId, date: { gte: since } },
    include: {
      fromNode: { select: { code: true, name: true } },
      toNode: { select: { code: true, name: true } },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 1000,
  })
  return NextResponse.json(transfers)
}

export async function POST(req: NextRequest) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const fromNodeId = String(body.fromNodeId ?? '')
  const toNodeId = String(body.toNodeId ?? '')
  const date = String(body.date ?? '').slice(0, 10)
  const volume = Number(body.volume)

  if (!fromNodeId || !toNodeId || !date) {
    return NextResponse.json({ error: 'fromNodeId, toNodeId and date are required' }, { status: 400 })
  }
  if (!Number.isFinite(volume)) return NextResponse.json({ error: 'volume must be a number' }, { status: 400 })

  const count = await prisma.node.count({
    where: { organizationId: ctx.organizationId, id: { in: [fromNodeId, toNodeId] } },
  })
  if (count < 2) return NextResponse.json({ error: 'Unknown node(s)' }, { status: 400 })

  const transfer = await prisma.transfer.create({
    data: {
      organizationId: ctx.organizationId,
      fromNodeId,
      toNodeId,
      date,
      volume,
      receiptVolume: body.receiptVolume != null ? Number(body.receiptVolume) : null,
      memo: body.memo ? String(body.memo) : null,
    },
  })
  return NextResponse.json(transfer, { status: 201 })
}
