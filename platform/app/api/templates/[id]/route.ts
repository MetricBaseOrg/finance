import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getRole } from '@/lib/permissions'

/**
 * DELETE /api/templates/:id
 * The template creator, or a workspace OWNER/ADMIN, may delete it.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const tpl = await prisma.template.findUnique({
    where: { id },
    select: { id: true, organizationId: true, createdById: true },
  })
  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const role = await getRole(session.user.id, tpl.organizationId)
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const isCreator = tpl.createdById === session.user.id
  const isManager = role === 'OWNER' || role === 'ADMIN'
  if (!isCreator && !isManager) {
    return NextResponse.json({ error: 'Only the creator or a workspace admin can delete this template.' }, { status: 403 })
  }

  await prisma.template.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
