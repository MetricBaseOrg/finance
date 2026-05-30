import { NextResponse } from 'next/server'
import { getOrgContext } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { postChatMessage } from '@/lib/chat/post'

/** Confirm the channel is in the active org and the user is a member. */
async function memberAccess(channelId: string, userId: string, organizationId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      organizationId: true,
      members: { where: { userId }, select: { id: true } },
    },
  })
  if (channel?.organizationId !== organizationId) return false
  return channel.members.length > 0
}

/** GET /api/chat/channels/[id]/messages?after=<messageId> — incremental poll. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, activeOrg } = await getOrgContext()
  if (!can(activeOrg.role, 'chat.read')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  if (!(await memberAccess(id, user.id, activeOrg.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const after = new URL(req.url).searchParams.get('after')
  let createdAtCursor: Date | undefined
  if (after) {
    const cursor = await prisma.chatMessage.findUnique({ where: { id: after }, select: { createdAt: true } })
    createdAtCursor = cursor?.createdAt
  }

  const messages = await prisma.chatMessage.findMany({
    where: { channelId: id, ...(createdAtCursor && { createdAt: { gt: createdAtCursor } }) },
    include: { user: { select: { id: true, name: true, email: true, image: true, kind: true } } },
    orderBy: { createdAt: 'asc' },
    // Without a cursor, return the most recent 100 (then reverse to asc).
    ...(createdAtCursor ? {} : { take: 100 }),
  })

  // Best-effort read receipt.
  void prisma.channelMember
    .update({ where: { channelId_userId: { channelId: id, userId: user.id } }, data: { lastReadAt: new Date() } })
    .catch(() => {})

  return NextResponse.json({ messages })
}

/** POST /api/chat/channels/[id]/messages — send a message. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, activeOrg } = await getOrgContext()
  if (!can(activeOrg.role, 'chat.send')) {
    return NextResponse.json({ error: 'Your role does not permit sending messages.' }, { status: 403 })
  }
  const { id } = await params
  if (!(await memberAccess(id, user.id, activeOrg.id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { content } = await req.json().catch(() => ({}))
  if (!content || !String(content).trim()) {
    return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
  }

  const message = await postChatMessage({ channelId: id, actorUserId: user.id, content: String(content).slice(0, 4000) })
  return NextResponse.json(message)
}
