import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFieldContext, FIELD_ENUMS, logFieldAudit } from '@/server/field'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const liftings = await prisma.lifting.findMany({
    where: { organizationId: ctx.organizationId },
    include: {
      fromNode: { select: { code: true, name: true } },
      buyerNode: { select: { code: true, name: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 500,
  })
  return NextResponse.json(liftings)
}

export async function POST(req: NextRequest) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const tankerName = String(body.tankerName ?? '').trim()
  if (!tankerName) return NextResponse.json({ error: 'tankerName is required' }, { status: 400 })

  const status = FIELD_ENUMS.LIFTING_STATUS.includes(body.status) ? body.status : 'tentative'
  const num = (v: unknown) => (v != null && v !== '' ? Number(v) : null)
  const str = (v: unknown) => (v ? String(v) : null)

  const lifting = await prisma.lifting.create({
    data: {
      organizationId: ctx.organizationId,
      fromNodeId: str(body.fromNodeId),
      buyerNodeId: str(body.buyerNodeId),
      tankerName,
      nominated: num(body.nominated),
      blVolume: num(body.blVolume),
      cqdVolume: num(body.cqdVolume),
      eta: str(body.eta),
      laycanStart: str(body.laycanStart),
      laycanEnd: str(body.laycanEnd),
      startLoad: str(body.startLoad),
      stopLoad: str(body.stopLoad),
      status,
      notes: str(body.notes),
    },
  })
  await logFieldAudit({
    organizationId: ctx.organizationId, userId: ctx.userId,
    action: 'CREATE', entityType: 'LIFTING', entityId: lifting.id, summary: `Scheduled lifting ${lifting.tankerName}`,
  })
  return NextResponse.json(lifting, { status: 201 })
}
