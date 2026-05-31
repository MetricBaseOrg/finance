import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFieldContext, FIELD_ENUMS, logFieldAudit } from '@/server/field'

export const dynamic = 'force-dynamic'

export async function GET() {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const nodes = await prisma.node.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: [{ active: 'desc' }, { code: 'asc' }],
  })
  return NextResponse.json(nodes)
}

export async function POST(req: NextRequest) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const code = String(body.code ?? '').trim().toUpperCase()
  const name = String(body.name ?? '').trim()
  const nodeType = String(body.nodeType ?? '').trim().toLowerCase()

  if (!code || !name) return NextResponse.json({ error: 'code and name are required' }, { status: 400 })
  if (!FIELD_ENUMS.NODE_TYPES.includes(nodeType)) {
    return NextResponse.json({ error: `nodeType must be one of ${FIELD_ENUMS.NODE_TYPES.join(', ')}` }, { status: 400 })
  }

  try {
    const node = await prisma.node.create({
      data: {
        organizationId: ctx.organizationId,
        code,
        name,
        nodeType,
        capacity: body.capacity != null ? Number(body.capacity) : null,
        unit: body.unit ? String(body.unit) : 'bbl',
        parentCode: body.parentCode ? String(body.parentCode).toUpperCase() : null,
        notes: body.notes ? String(body.notes) : null,
        openingStock: body.openingStock != null ? Number(body.openingStock) : 0,
      },
    })
    await logFieldAudit({
      organizationId: ctx.organizationId, userId: ctx.userId,
      action: 'CREATE', entityType: 'NODE', entityId: node.id, summary: `Added node ${code} (${name})`,
    })
    return NextResponse.json(node, { status: 201 })
  } catch (e: unknown) {
    // Unique (organizationId, code) violation.
    return NextResponse.json({ error: 'A node with that code already exists' }, { status: 409 })
  }
}
