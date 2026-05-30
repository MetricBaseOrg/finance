import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFieldContext, logFieldAudit } from '@/server/field'

export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getFieldContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  // Scope the delete to the active org so cross-tenant ids can't be removed.
  const res = await prisma.transfer.deleteMany({ where: { id, organizationId: ctx.organizationId } })
  if (res.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await logFieldAudit({
    organizationId: ctx.organizationId, userId: ctx.userId,
    action: 'DELETE', entityType: 'TRANSFER', entityId: id, summary: 'Deleted a transfer',
  })
  return NextResponse.json({ ok: true })
}
