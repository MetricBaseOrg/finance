import { NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'

/** GET — channel members + (for managers) org members not yet in the channel. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, activeOrg } = await getOrgContext()
  const { id } = await params

  const channel = await prisma.channel.findUnique({
    where: { id },
    select: {
      organizationId: true,
      members: {
        select: { user: { select: { id: true, name: true, email: true, image: true, kind: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (channel?.organizationId !== activeOrg.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isMember = channel.members.some(m => m.user.id === user.id)
  if (!isMember && !can(activeOrg.role, 'chat.channel.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const members = channel.members.map(m => m.user)

  let candidates: typeof members = []
  if (can(activeOrg.role, 'chat.channel.manage')) {
    const present = new Set(members.map(m => m.id))
    const orgMembers = await prisma.membership.findMany({
      where: { organizationId: activeOrg.id },
      select: { user: { select: { id: true, name: true, email: true, image: true, kind: true } } },
    })
    candidates = orgMembers.map(m => m.user).filter(u => !present.has(u.id))
  }

  return NextResponse.json({ members, candidates })
}

/** POST — add a member (org member) to the channel. Managers only. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { activeOrg } = await getOrgContext()
  if (!can(activeOrg.role, 'chat.channel.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { id } = await params
  const channel = await prisma.channel.findUnique({ where: { id }, select: { organizationId: true } })
  if (channel?.organizationId !== activeOrg.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { userId } = await req.json().catch(() => ({}))
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  // The target must belong to this org.
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId: activeOrg.id } },
    select: { id: true },
  })
  if (!membership) return NextResponse.json({ error: 'Not a workspace member' }, { status: 400 })

  await prisma.channelMember.upsert({
    where: { channelId_userId: { channelId: id, userId } },
    create: { channelId: id, userId },
    update: {},
  })
  return NextResponse.json({ ok: true })
}
