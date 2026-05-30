import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { postChatMessage } from '@/lib/chat/post'
import type { AgentTool, ToolContext } from '@/lib/agent/types'

/** The agent must be a member of the channel, and the channel in its org. */
async function channelAccess(channelId: string, ctx: ToolContext): Promise<boolean> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      organizationId: true,
      members: { where: { userId: ctx.agentUserId }, select: { id: true } },
    },
  })
  return channel?.organizationId === ctx.organizationId && channel.members.length > 0
}

const getChannelMessages: AgentTool = {
  scope: 'chat',
  definition: {
    name: 'get_channel_messages',
    description: 'Read recent messages from a chat channel you belong to.',
    input_schema: {
      type: 'object',
      properties: {
        channelId: { type: 'string' },
        limit: { type: 'number', description: 'Max messages (default 30, max 100).' },
      },
      required: ['channelId'],
    },
  },
  async execute(ctx: ToolContext, input: { channelId: string; limit?: number }) {
    if (!(await channelAccess(input.channelId, ctx))) return { error: 'Channel not found or you are not a member.' }
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 100)
    const messages = await prisma.chatMessage.findMany({
      where: { channelId: input.channelId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return {
      messages: messages
        .slice()
        .reverse()
        .map(m => ({
          author: m.user.name ?? m.user.email,
          createdAt: m.createdAt.toISOString(),
          content: m.content,
        })),
    }
  },
}

const postChatMessageTool: AgentTool = {
  scope: 'chat',
  definition: {
    name: 'post_chat_message',
    description: 'Post a message to a chat channel you belong to. Use this to reply in the channel. You can @mention people.',
    input_schema: {
      type: 'object',
      properties: {
        channelId: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['channelId', 'content'],
    },
  },
  async execute(ctx: ToolContext, input: { channelId: string; content: string }) {
    if (!can(ctx.agentRole, 'chat.send')) return { error: 'Your role does not permit sending chat messages.' }
    if (!(await channelAccess(input.channelId, ctx))) return { error: 'Channel not found or you are not a member.' }
    const message = await postChatMessage({ channelId: input.channelId, actorUserId: ctx.agentUserId, content: input.content })
    return { ok: true, messageId: message.id }
  },
}

export const chatTools: AgentTool[] = [getChannelMessages, postChatMessageTool]
