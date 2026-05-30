import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFieldContext } from '@/server/field'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const data: Record<string, unknown> = {}
  for (const k of ['name', 'unit', 'parentCode', 'notes'] as const) {
    if (body[k] !== undefined) data[k] = body[k] === null ? null : String(body[k])
  }
  if (body.capacity !== undefined) data.capacity = body.capacity === null ? null : Number(body.capacity)
  if (body.openingStock !== undefined) data.openingStock = Number(body.openingStock)
  if (body.active !== undefined) data.active = Boolean(body.active)

  const res = await prisma.node.updateMany({
    where: { id, organizationId: ctx.organizationId },
    data,
  })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const res = await prisma.node.deleteMany({ where: { id, organizationId: ctx.organizationId } })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
