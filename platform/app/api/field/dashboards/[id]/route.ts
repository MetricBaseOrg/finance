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
  if (body.name !== undefined) data.name = String(body.name)
  if (body.layoutJson !== undefined) data.layoutJson = String(body.layoutJson)
  if (body.active !== undefined) data.active = Boolean(body.active)

  // Activating one dashboard deactivates the others (single active per user).
  if (data.active === true) {
    await prisma.userDashboard.updateMany({ where: { userId: ctx.userId }, data: { active: false } })
  }

  const res = await prisma.userDashboard.updateMany({ where: { id, userId: ctx.userId }, data })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const res = await prisma.userDashboard.deleteMany({ where: { id, userId: ctx.userId } })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
