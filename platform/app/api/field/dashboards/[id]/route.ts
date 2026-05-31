import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFieldContext } from '@/server/field'

export const dynamic = 'force-dynamic'

const canManage = (role: string) => role === 'OWNER' || role === 'ADMIN'

// Confirm the dashboard exists and belongs to the active org (its creator is a
// member), so admins can manage shared dashboards but never reach across orgs.
async function orgDashboard(id: string, organizationId: string) {
  return prisma.userDashboard.findFirst({
    where: { id, user: { members: { some: { organizationId } } } },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(ctx.role)) {
    return NextResponse.json({ error: 'Only owners and admins can edit dashboards' }, { status: 403 })
  }
  const { id } = await params
  const body = await req.json().catch(() => ({}))

  if (!(await orgDashboard(id, ctx.organizationId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = String(body.name)
  if (body.layoutJson !== undefined) data.layoutJson = String(body.layoutJson)
  if (body.active !== undefined) data.active = Boolean(body.active)

  // The active dashboard is the workspace default — only one across the org.
  if (data.active === true) {
    const orgIds = (await prisma.userDashboard.findMany({
      where: { user: { members: { some: { organizationId: ctx.organizationId } } } },
      select: { id: true },
    })).map((d) => d.id)
    await prisma.userDashboard.updateMany({ where: { id: { in: orgIds } }, data: { active: false } })
  }

  await prisma.userDashboard.update({ where: { id }, data })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(ctx.role)) {
    return NextResponse.json({ error: 'Only owners and admins can delete dashboards' }, { status: 403 })
  }
  const { id } = await params
  if (!(await orgDashboard(id, ctx.organizationId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await prisma.userDashboard.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
