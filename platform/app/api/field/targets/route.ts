import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFieldContext, FIELD_ENUMS, logFieldAudit } from '@/server/field'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const year = url.searchParams.get('year') ? Number(url.searchParams.get('year')) : undefined

  const targets = await prisma.target.findMany({
    where: { organizationId: ctx.organizationId, ...(year ? { year } : {}) },
    include: { node: { select: { code: true, name: true } } },
    orderBy: [{ year: 'desc' }, { month: 'asc' }],
  })
  return NextResponse.json(targets)
}

// Upsert a monthly target (unique per org/node/year/month/category).
export async function POST(req: NextRequest) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const nodeId = String(body.nodeId ?? '')
  const year = Number(body.year)
  const month = Number(body.month)
  const category = FIELD_ENUMS.TARGET_CATEGORIES.includes(body.category) ? body.category : 'production'

  if (!nodeId || !Number.isInteger(year) || !(month >= 1 && month <= 12)) {
    return NextResponse.json({ error: 'nodeId, year and month (1-12) are required' }, { status: 400 })
  }
  const node = await prisma.node.findFirst({ where: { id: nodeId, organizationId: ctx.organizationId } })
  if (!node) return NextResponse.json({ error: 'Unknown node' }, { status: 400 })

  const targetVol = body.targetVol != null && body.targetVol !== '' ? Number(body.targetVol) : null

  const target = await prisma.target.upsert({
    where: {
      organizationId_nodeId_year_month_category: {
        organizationId: ctx.organizationId,
        nodeId,
        year,
        month,
        category,
      },
    },
    create: { organizationId: ctx.organizationId, nodeId, year, month, category, targetVol },
    update: { targetVol },
  })
  await logFieldAudit({
    organizationId: ctx.organizationId, userId: ctx.userId,
    action: 'UPSERT', entityType: 'TARGET', entityId: target.id, summary: `Set ${target.category} target for ${target.year}-${String(target.month).padStart(2, '0')}`,
  })
  return NextResponse.json(target, { status: 201 })
}
