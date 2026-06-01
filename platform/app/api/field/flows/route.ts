import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFieldContext, createFlow } from '@/server/field'

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
  const result = await createFlow({ organizationId: ctx.organizationId, userId: ctx.userId }, body)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.flow, { status: 201 })
}
