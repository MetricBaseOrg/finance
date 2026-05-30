import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { can, getRole, isRole } from '@/lib/permissions'

/**
 * POST /api/members  — invite an existing user to a workspace.
 * Body: { email, organizationId, role? }
 *
 * Caller must be OWNER or ADMIN of the workspace. ADMINs cannot grant OWNER
 * straight away — the invited role is silently downgraded to ADMIN if so.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, organizationId, role } = await req.json()
  if (!email || !organizationId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const actorRole = await getRole(session.user.id, organizationId)
  if (!actorRole || !can(actorRole, 'workspace.member.invite')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const existing = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: user.id, organizationId } },
    select: { id: true },
  })
  if (existing) return NextResponse.json({ error: 'Already a member' }, { status: 400 })

  // ADMINs cannot create OWNER seats
  let requestedRole = isRole(role) ? role : 'MEMBER'
  if (actorRole === 'ADMIN' && requestedRole === 'OWNER') requestedRole = 'ADMIN'

  const member = await prisma.membership.create({
    data: { userId: user.id, organizationId, role: requestedRole },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  })

  return NextResponse.json(member)
}
