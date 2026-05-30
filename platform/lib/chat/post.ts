import { prisma } from '@/lib/prisma'
import { extractMentionHandles, resolveMentions } from '@/lib/activity'

/**
 * Shared chat message-posting service. Creates the message and, if it @mentions
 * any agent that belongs to the channel, dispatches a chat agent run (lazy
 * import keeps the agent runtime out of this module's static graph and avoids a
 * cycle). Used by the HTTP route and the agent's post_chat_message tool — and
 * because dispatch skips agent authors, an agent's own message can't trigger a
 * cascade.
 */
export async function postChatMessage(opts: {
  channelId: string
  actorUserId: string
  content: string
}) {
  const message = await prisma.chatMessage.create({
    data: { channelId: opts.channelId, userId: opts.actorUserId, content: opts.content },
    include: { user: { select: { id: true, name: true, email: true, image: true, kind: true } } },
  })

  const handles = extractMentionHandles(opts.content)
  if (handles.length > 0) {
    const members = await prisma.channelMember.findMany({
      where: { channelId: opts.channelId },
      select: { user: { select: { id: true, name: true, email: true } } },
    })
    const mentionedIds = resolveMentions(handles, members)
    if (mentionedIds.length > 0) {
      void import('@/lib/agent/dispatch')
        .then(m => m.dispatchChatAgents({
          channelId: opts.channelId,
          messageId: message.id,
          mentionedUserIds: mentionedIds,
          actorId: opts.actorUserId,
        }))
        .catch(err => console.error('chat agent dispatch failed', err))
    }
  }

  return message
}
