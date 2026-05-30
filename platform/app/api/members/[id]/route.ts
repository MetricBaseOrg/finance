import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getRole, isRole, validateMemberRemoval, validateRoleChange, type Role } from '@/lib/permissions'

/**
 * PATCH /api/members/:id   body: { role }
 * Change a workspace member's role. The :id is the Membership row id.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({} as { role?: string }))
  const newRole = body.role

  const target = await prisma.membership.findUnique({
    where: { id },
    select: { id: true, role: true, userId: true, organizationId: true },
  })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const actorRole = await getRole(session.user.id, target.organizationId)
  if (!actorRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const targetCurrent: Role = isRole(target.role) ? target.role : 'VIEWER'
  const err = await validateRoleChange({
    actorRole,
    targetCurrentRole: targetCurrent,
    targetNewRole: newRole ?? '',
    organizationId: target.organizationId,
  })
  if (err) return NextResponse.json({ error: err }, { status: 400 })

  const updated = await prisma.membership.update({
    where: { id },
    data: { role: newRole as Role },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  })
  return NextResponse.json(updated)
}

/**
 * DELETE /api/members/:id — remove a member from the workspace.
 * The user's account is not deleted; just their Membership row.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const target = await prisma.membership.findUnique({
    where: { id },
    select: { id: true, role: true, userId: true, organizationId: true },
  })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const actorRole = await getRole(session.user.id, target.organizationId)
  if (!actorRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // A user may remove themselves — except the last OWNER.
  const isSelf = target.userId === session.user.id
  const targetRole: Role = isRole(target.role) ? target.role : 'VIEWER'
  if (!isSelf) {
    const err = await validateMemberRemoval({
      actorRole,
      targetRole,
      organizationId: target.organizationId,
    })
    if (err) return NextResponse.json({ error: err }, { status: 400 })
  } else if (targetRole === 'OWNER') {
    const ownerCount = await prisma.membership.count({
      where: { organizationId: target.organizationId, role: 'OWNER' },
    })
    if (ownerCount <= 1) {
      return NextResponse.json(
        { error: 'You\'re the only Owner — transfer ownership before leaving.' },
        { status: 400 },
      )
    }
  }

  await prisma.membership.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
