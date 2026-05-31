import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFieldContext } from '@/server/field'

export const dynamic = 'force-dynamic'

/** GET /api/field/members — human members of the active org, for the field-task assignee picker. */
export async function GET() {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const members = await prisma.membership.findMany({
    where: { organizationId: ctx.organizationId, user: { kind: 'HUMAN' } },
    select: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(members.map((m) => m.user))
}
