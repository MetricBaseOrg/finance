import { NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { slugify } from '@/server/workspace'

/** GET /api/chat/channels — channels in the active org the user belongs to. */
export async function GET() {
  const { user, activeOrg } = await getOrgContext()

  const channels = await prisma.channel.findMany({
    where: { organizationId: activeOrg.id, members: { some: { userId: user.id } } },
    select: {
      id: true, name: true, slug: true, kind: true, isPrivate: true,
      _count: { select: { members: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true, createdAt: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    channels: channels.map(c => ({
      id: c.id, name: c.name, slug: c.slug, kind: c.kind, isPrivate: c.isPrivate,
      memberCount: c._count.members,
      lastMessage: c.messages[0] ?? null,
    })),
  })
}

/** POST /api/chat/channels — create a channel (admins/owners only). */
export async function POST(req: Request) {
  const { user, activeOrg } = await getOrgContext()
  if (!can(activeOrg.role, 'chat.channel.manage')) {
    return NextResponse.json({ error: 'Your role does not permit creating channels.' }, { status: 403 })
  }

  const { name, isPrivate } = await req.json().catch(() => ({}))
  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Channel name is required.' }, { status: 400 })
  }

  // Unique slug within the org.
  const base = slugify(name)
  let slug = base
  for (let i = 2; await prisma.channel.findUnique({ where: { organizationId_slug: { organizationId: activeOrg.id, slug } } }); i++) {
    slug = `${base}-${i}`
  }

  // Public channels seed every current org member; private channels start with
  // just the creator (others/agents are added explicitly).
  const memberUserIds = isPrivate
    ? [user.id]
    : (await prisma.membership.findMany({
        where: { organizationId: activeOrg.id },
        select: { userId: true },
      })).map(m => m.userId)
  if (!memberUserIds.includes(user.id)) memberUserIds.push(user.id)

  const channel = await prisma.channel.create({
    data: {
      organizationId: activeOrg.id,
      name: name.slice(0, 60),
      slug,
      isPrivate: Boolean(isPrivate),
      createdById: user.id,
      members: { create: memberUserIds.map(uid => ({ userId: uid })) },
    },
    select: { id: true, name: true, slug: true, kind: true, isPrivate: true },
  })

  return NextResponse.json(channel)
}
