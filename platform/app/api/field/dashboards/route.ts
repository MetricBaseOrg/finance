import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFieldContext } from '@/server/field'

export const dynamic = 'force-dynamic'

const canManage = (role: string) => role === 'OWNER' || role === 'ADMIN'

// Dashboards are shared across the workspace: any member sees every dashboard
// created by someone in the active org. (Resolved via the creator's membership
// — no per-row org column needed.) Management is OWNER/ADMIN-only.
export async function GET() {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // Dashboards are an OWNER/ADMIN-managed shared resource: list only those
  // authored by a manager of the active org. This also hides legacy rows that
  // members auto-created before the model became admin-managed.
  const dashboards = await prisma.userDashboard.findMany({
    where: {
      user: { members: { some: { organizationId: ctx.organizationId, role: { in: ['OWNER', 'ADMIN'] } } } },
    },
    orderBy: { createdAt: 'asc' },
    include: { user: { select: { name: true, email: true } } },
  })
  return NextResponse.json(dashboards.map((d) => ({
    id: d.id,
    name: d.name,
    active: d.active,
    layoutJson: d.layoutJson,
    createdById: d.userId,
    creatorName: d.user?.name || d.user?.email || null,
  })))
}

export async function POST(req: NextRequest) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canManage(ctx.role)) {
    return NextResponse.json({ error: 'Only owners and admins can create dashboards' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? 'My Dashboard').trim() || 'My Dashboard'

  try {
    const dashboard = await prisma.userDashboard.create({
      data: {
        userId: ctx.userId,
        name,
        layoutJson: typeof body.layoutJson === 'string' ? body.layoutJson : '{"widgets":[]}',
      },
    })
    return NextResponse.json(dashboard, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'A dashboard with that name already exists' }, { status: 409 })
  }
}
