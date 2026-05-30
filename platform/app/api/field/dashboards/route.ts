import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFieldContext } from '@/server/field'

export const dynamic = 'force-dynamic'

// Per-user dashboard layouts for the widget builder.
export async function GET() {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const dashboards = await prisma.userDashboard.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(dashboards)
}

export async function POST(req: NextRequest) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
