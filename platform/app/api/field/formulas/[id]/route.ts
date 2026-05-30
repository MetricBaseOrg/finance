import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFieldContext } from '@/server/field'

export const dynamic = 'force-dynamic'

const MODES = ['auto', 'daily', 'cumulative']

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = String(body.name)
  if (body.expr !== undefined) data.expr = String(body.expr)
  if (body.description !== undefined) data.description = body.description ? String(body.description) : null
  if (body.refSeriesMode !== undefined && MODES.includes(body.refSeriesMode)) data.refSeriesMode = body.refSeriesMode

  const res = await prisma.userFormula.updateMany({ where: { id, userId: ctx.userId }, data })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const res = await prisma.userFormula.deleteMany({ where: { id, userId: ctx.userId } })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
