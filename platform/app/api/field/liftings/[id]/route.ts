import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFieldContext, FIELD_ENUMS } from '@/server/field'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const data: Record<string, unknown> = {}
  for (const k of ['tankerName', 'eta', 'laycanStart', 'laycanEnd', 'startLoad', 'stopLoad', 'notes', 'fromNodeId', 'buyerNodeId'] as const) {
    if (body[k] !== undefined) data[k] = body[k] === null || body[k] === '' ? null : String(body[k])
  }
  for (const k of ['nominated', 'blVolume', 'cqdVolume'] as const) {
    if (body[k] !== undefined) data[k] = body[k] == null || body[k] === '' ? null : Number(body[k])
  }
  if (body.status !== undefined && FIELD_ENUMS.LIFTING_STATUS.includes(body.status)) data.status = body.status

  const res = await prisma.lifting.updateMany({ where: { id, organizationId: ctx.organizationId }, data })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const res = await prisma.lifting.deleteMany({ where: { id, organizationId: ctx.organizationId } })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
